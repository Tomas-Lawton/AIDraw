import pydiffvg
import torch
import random
import copy


def calculate_draw_region(region, normaliseScaleFactor):
    leftX = min(
        float(region['x1']) * normaliseScaleFactor,
        float(region['x2']) * normaliseScaleFactor,
    )
    rightX = max(
        float(region['x1']) * normaliseScaleFactor,
        float(region['x2']) * normaliseScaleFactor,
    )
    bottomY = min(
        float(region['y1']) * normaliseScaleFactor,
        float(region['y2']) * normaliseScaleFactor,
    )
    topY = max(
        float(region['y1']) * normaliseScaleFactor,
        float(region['y2']) * normaliseScaleFactor,
    )

    return {
        'x0': leftX,
        'x1': rightX,
        'y0': bottomY,
        'y1': topY,
    }


def rescale_constants(shapes, groups, scale_ratio):
    """Scale up points since they are absolute positioned."""
    shapes_copy = copy.deepcopy(shapes)
    shape_groups_copy = copy.deepcopy(groups)
    for path in shapes_copy:
        path.points = torch.div(path.points, scale_ratio)
        path.stroke_width = torch.div(path.stroke_width, scale_ratio)
    return shapes_copy, shape_groups_copy


class UserSketch:
    def __init__(self, path_list, canvas_height, canvas_width):

        # Initialize Curves
        shapes = []
        shape_groups = []

        # First the ones from my drawing
        for dpath in path_list:
            num_control_points = torch.zeros(dpath.num_segments, dtype=torch.int32) + 2
            points = torch.zeros_like(dpath.path)
            stroke_width = dpath.width * 100
            points[:, 0] = canvas_width * dpath.path[:, 0]
            points[:, 1] = canvas_height * dpath.path[:, 1]
            path = pydiffvg.Path(
                num_control_points=num_control_points,
                points=points,
                stroke_width=stroke_width,
                is_closed=False,
            )
            shapes.append(path)
            path_group = pydiffvg.ShapeGroup(
                shape_ids=torch.tensor([len(shapes) - 1]),
                fill_color=None,
                stroke_color=dpath.color,
            )
            shape_groups.append(path_group)

        if not path_list:
            img = torch.ones(
                (1, 3, canvas_height, canvas_width),
                device='cuda:0' if torch.cuda.is_available() else 'cpu',
            )
        else:
            scene_args = pydiffvg.RenderFunction.serialize_scene(
                canvas_width, canvas_height, shapes, shape_groups
            )
            render = pydiffvg.RenderFunction.apply
            img = render(canvas_width, canvas_height, 2, 2, 0, None, *scene_args)
            img = img[:, :, 3:4] * img[:, :, :3] + torch.ones(
                img.shape[0], img.shape[1], 3, device=pydiffvg.get_device()
            ) * (1 - img[:, :, 3:4])
            img = img[:, :, :3].unsqueeze(0).permute(0, 3, 1, 2)

        self.shapes = shapes
        self.shape_groups = shape_groups
        self.img = img

    def init_vars(self):
        self.points_vars = []
        self.stroke_width_vars = []
        self.color_vars = []
        for path in self.shapes:
            path.points.requires_grad = True
            self.points_vars.append(path.points)
            path.stroke_width.requires_grad = True
            self.stroke_width_vars.append(path.stroke_width)
        for group in self.shape_groups:
            group.stroke_color.requires_grad = True
            self.color_vars.append(group.stroke_color)


def treebranch_initialization(
    path_list,
    num_paths,
    canvas_width,
    canvas_height,
    drawing_area={'x0': 0, 'x1': 1, 'y0': 0, 'y1': 1},
    partition={'K1': 0.25, 'K2': 0.5, 'K3': 0.25},
):

    '''
    K1: % of curves starting from existing endpoints
    K2: % of curves starting from curves in K1
    K3: % of andom curves
    '''

    x0 = drawing_area['x0']
    x1 = drawing_area['x1']
    y0 = drawing_area['y0']
    y1 = drawing_area['y1']

    # Get all endpoints within drawing region
    starting_points = []
    for path in path_list:
        for k in range(path.path.size(0)):
            if k % 3 == 0:
                if (x0 < path.path[k, 0] < x1) and (y0 < (1 - path.path[k, 1]) < y1):
                    starting_points.append(tuple([x.item() for x in path.path[k]]))

    # If no endpoints in drawing zone, we make everything random
    K1 = round(partition['K1'] * num_paths) if starting_points else 0
    K2 = round(partition['K2'] * num_paths) if starting_points else 0

    # Initialize Curves
    shapes = []
    shape_groups = []
    first_endpoints = []

    # Add random curves
    for k in range(num_paths):
        num_segments = random.randint(1, 3)
        num_control_points = torch.zeros(num_segments, dtype=torch.int32) + 2
        points = []
        if k < K1:
            p0 = random.choice(starting_points)
        elif k < K2:
            p0 = random.choice(first_endpoints)
        else:
            p0 = (
                random.random() * (x1 - x0) + x0,
                random.random() * (y1 - y0) + 1 - y1,
            )
        points.append(p0)

        for j in range(num_segments):
            radius = 0.1
            p1 = (
                p0[0] + radius * (random.random() - 0.5),
                p0[1] + radius * (random.random() - 0.5),
            )
            p2 = (
                p1[0] + radius * (random.random() - 0.5),
                p1[1] + radius * (random.random() - 0.5),
            )
            p3 = (
                p2[0] + radius * (random.random() - 0.5),
                p2[1] + radius * (random.random() - 0.5),
            )
            points.append(p1)
            points.append(p2)
            points.append(p3)
            p0 = p3

        if k < K1:
            first_endpoints.append(points[-1])

        points = torch.tensor(points)
        points[:, 0] *= canvas_width
        points[:, 1] *= canvas_height
        path = pydiffvg.Path(
            num_control_points=num_control_points,
            points=points,
            stroke_width=torch.tensor(1.0),
            is_closed=False,
        )
        shapes.append(path)
        path_group = pydiffvg.ShapeGroup(
            shape_ids=torch.tensor([len(shapes) - 1]),
            fill_color=None,
            stroke_color=torch.tensor(
                [random.random(), random.random(), random.random(), random.random()]
            ),
        )
        shape_groups.append(path_group)

    return shapes, shape_groups


def add_shape_groups(a, b):
    shape_groups = []
    for k, group in enumerate(a + b):
        group.shape_ids = torch.tensor([k])
        shape_groups.append(group)
    return shape_groups