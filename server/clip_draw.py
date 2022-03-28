import torch
import pydiffvg
import torchvision.transforms as transforms
import datetime
import numpy as np
# make a util directory???
from clip_util import get_noun_data, get_drawing_paths, area_mask, save_data
from render_design import add_shape_groups, load_vars, render_save_img, build_random_curves
import logging

class Clip_Draw_Optimiser:
    __instance = None
    def __init__(self, model, noun_features):
        """These inputs are defaults and can have methods for setting them after the inital start up"""
        if Clip_Draw_Optimiser.__instance != None:  # Should this all be refactored to not be a "class instance" since it is only used once?
            raise Exception("Clip is already instantiated.")
        # Set up parent
        self.model = model
        # Partial sketch
        self.svg_path = 'data/drawing_flower_vase.svg'
        # Array set as arrays
        self.text_features = []
        self.neg_text_features = []
        self.nouns_features = noun_features
        self.use_neg_prompts = False
        self.normalize_clip = True
        # Canvas parameters
        self.num_paths = 32
        self.canvas_h = 224
        self.canvas_w = 224
        self.max_width = 40
        # Algorithm parameters
        self.num_iter = 1001
        self.w_points = 0.01
        self.w_colors = 0.1
        self.w_widths = 0.01
        self.w_img = 0.01
        # self.w_full_img = 0.001
        self.drawing_area = {
            'x0': 0.0,
            'x1': 1.0,
            'y0': 0.5,
            'y1': 1.0
        }
        self.update_frequency = 5
        self.is_stopping = False
        self.is_active = False
        # Configure rasterisor
        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        pydiffvg.set_print_timing(False)
        pydiffvg.set_use_gpu(torch.cuda.is_available())
        pydiffvg.set_device(device)
        
        # Configure image Augmentation Transformation
        if self.normalize_clip:
            self.augment_trans = transforms.Compose([
            transforms.RandomPerspective(fill=1, p=1, distortion_scale=0.5),
            transforms.RandomResizedCrop(self.canvas_w, scale=(0.7,0.9)),
            transforms.Normalize((0.48145466, 0.4578275, 0.40821073), (0.26862954, 0.26130258, 0.27577711))]) 
        else: 
            self.augment_trans = transforms.Compose([
            transforms.RandomPerspective(fill=1, p=1, distortion_scale=0.5),
            transforms.RandomResizedCrop(self.canvas_w, scale=(0.7,0.9))])
        logging.info("Drawer ready")
        Clip_Draw_Optimiser.__instance == self 
        return 

    def set_text_features(self, text_features, neg_text_features = []):
        self.text_features = text_features
        self.neg_text_features = neg_text_features
        logging.info("Updated CLIP prompt features")
        return

    def stop_clip_draw(self):
        logging.info("Stopping Clip draw")
        self.is_stopping = True

    # HOW TO ABORT WITH NEW PROMPT?
    def activate(self):
        self.is_active = True
        # SET UP IMAGE STEP ----------------------
        device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        path_list = get_drawing_paths(self.svg_path) # update with new method
        shapes, shape_groups = render_save_img(path_list, self.canvas_w, self.canvas_h)
        shapes_rnd, shape_groups_rnd = build_random_curves(
            self.num_paths,
            self.canvas_w,
            self.canvas_h,
            self.drawing_area['x0'],
            self.drawing_area['x1'],
            self.drawing_area['y0'],
            self.drawing_area['y1'],
            )
        shapes += shapes_rnd
        shape_groups = add_shape_groups(shape_groups, shape_groups_rnd)

        points_vars0, stroke_width_vars0, color_vars0, img0 = load_vars()

        points_vars = []
        stroke_width_vars = []
        color_vars = []
        for path in shapes:
            path.points.requires_grad = True
            points_vars.append(path.points)
            path.stroke_width.requires_grad = True
            stroke_width_vars.append(path.stroke_width)
        for group in shape_groups:
            group.stroke_color.requires_grad = True
            color_vars.append(group.stroke_color)

        scene_args = pydiffvg.RenderFunction.serialize_scene(\
            self.canvas_w, self.canvas_h, shapes, shape_groups)
        render = pydiffvg.RenderFunction.apply

        mask = area_mask(
            self.canvas_w,
            self.canvas_h,
            self.drawing_area['x0'],
            self.drawing_area['x1'],
            self.drawing_area['y0'],
            self.drawing_area['y1'],
            ).to(device)

        # Optimizers
        points_optim = torch.optim.Adam(points_vars, lr=0.5)
        width_optim = torch.optim.Adam(stroke_width_vars, lr=0.1)
        color_optim = torch.optim.Adam(color_vars, lr=0.01)

        # RUN MAIN OPTIMISER LOOP ____------------
        time_str = datetime.datetime.today().strftime("%Y_%m_%d_%H_%M_%S")
        if self.nouns_features != []:
            nouns = get_noun_data() # could add to clip class?
        for t in range(self.num_iter):
            if self.is_stopping:
                break
            logging.info("Running draw optimiser")
            points_optim.zero_grad()
            width_optim.zero_grad()
            color_optim.zero_grad()
            scene_args = pydiffvg.RenderFunction.serialize_scene(\
                self.canvas_w, self.canvas_h, shapes, shape_groups)
            img = render(self.canvas_w, self.canvas_h, 2, 2, t, None, *scene_args)
            img = img[:, :, 3:4] * img[:, :, :3] + torch.ones(img.shape[0], img.shape[1], 3, device = pydiffvg.get_device()) * (1 - img[:, :, 3:4])

            if self.w_img >0:
                l_img = torch.norm((img-img0.to(device))*mask).view(1)
            else:
                l_img = torch.tensor([0], device=device)

            img = img[:, :, :3]
            img = img.unsqueeze(0)
            img = img.permute(0, 3, 1, 2) # NHWC -> NCHW

            loss = 0
            loss += self.w_img*l_img.item()

            NUM_AUGS = 4
            img_augs = []
            for n in range(NUM_AUGS):
                img_augs.append(self.augment_trans(img))
            im_batch = torch.cat(img_augs)
            image_features = self.model.encode_image(im_batch)
            for n in range(NUM_AUGS):
                loss -= torch.cosine_similarity(self.text_features, image_features[n:n+1], dim=1)
                if self.use_neg_prompts:
                    loss += torch.cosine_similarity(self.neg_text_features, image_features[n:n+1], dim=1) * 0.3

            # B\'ezier losses
            l_points = 0
            l_widths = 0
            l_colors = 0
            
            for k, points0 in enumerate(points_vars0):
                l_points += torch.norm(points_vars[k]-points0)
                l_colors += torch.norm(color_vars[k]-color_vars0[k])
                l_widths += torch.norm(stroke_width_vars[k]-stroke_width_vars0[k])
            
            loss += self.w_points*l_points
            loss += self.w_colors*l_colors
            loss += self.w_widths*l_widths   

            # Backpropagate the gradients.
            loss.backward()

            # Take a gradient descent step.
            points_optim.step() # at this point path is updated ? should be able to stream this to fe in real time
            width_optim.step()
            color_optim.step()
            for path in shapes:
                path.stroke_width.data.clamp_(1.0, self.max_width)
            for group in shape_groups:
                group.stroke_color.data.clamp_(0.0, 1.0)

            # This is just to check out the progress
            if t % self.update_frequency == 0:
                logging.info(f"render loss: {loss.item()}")
                logging.info(f"l_points: {l_points.item()}")
                logging.info(f"l_colors: {l_colors.item()}")
                logging.info(f"l_widths: {l_widths.item()}")
                logging.info(f"l_img: {l_img.item()}")
                # for l in l_style:
                #     print('l_style: ', l.item())
                logging.info(f"iteration: {t}")
                with torch.no_grad():
                    pydiffvg.imwrite(img.cpu().permute(0, 2, 3, 1).squeeze(0), 'results/'+time_str+'.png', gamma=1)
                    # Calc similarity to noun classes.
                    if self.nouns_features != []:
                        im_norm = image_features / image_features.norm(dim=-1, keepdim=True)
                        noun_norm = self.nouns_features / self.nouns_features.norm(dim=-1, keepdim=True)
                        similarity = (100.0 * im_norm @ noun_norm.T).softmax(dim=-1)
                        values, indices = similarity[0].topk(5)
                        logging.info("\nTop predictions:\n")
                        for value, index in zip(values, indices):
                            logging.info(f"{nouns[index]:>16s}: {100 * value.item():.2f}%")
        logging.info("Stopping clip drawer")
        pydiffvg.imwrite(img.cpu().permute(0, 2, 3, 1).squeeze(0), 'results/'+time_str+'.png', gamma=1)
        save_data(time_str, self)
        self.is_active = False
        self.is_stopping = False
        logging.info("Drawer ready for restart")
        return



           # def use_svg_from_file(self, path_input):
    #     return
