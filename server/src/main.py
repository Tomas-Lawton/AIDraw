import logging
import os
import uvicorn
# from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

from drawer import Drawer
from clip_instance import Clip_Instance
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request

# TO DO add environment var to set log mode
logging.basicConfig(
    level=logging.DEBUG,
    format=f'APP LOGGING: %(levelname)s %(name)s %(threadName)s : %(message)s',
)

logging.info("Starting App")

app = FastAPI(title="Clip Algorithm API")
origins = [
    "http://127.0.0.1:8000",
    "https://tomas-lawton.github.io/drawing-client",
    "https://tomas-lawton.github.io",
    "http://localhost:5500"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    cluster = MongoClient(
        os.environ.get('MONGODB_URI')
    )
    db = cluster["vector_ai"]
    collection = db["interaction_events"]
except ValueError as e:
    logging.error("Bad credentials \n", e)


@app.post("/save_interactions")
async def getInformation(info: Request):
    interaction_json = await info.json()
    print(interaction_json)
    try:
        collection.find_one_and_update(
            {"log_time": interaction_json["log_time"]}, # Log mode
            {"$set": {
                "user_id": interaction_json["user_id"],
                "recorded_data": interaction_json["recorded_data"]
                }
            },
            upsert=True,
        )
        return {
            "status": "SUCCESS",
        }
    except Exception as e:
        logging.error(e)


@app.get("/")
async def home():
    return {"hello", "world"}


# if not os.environ.get('CONNECTAI') == "True":
#     logging.info("Running without AI")
# else:
#     logging.info("Establishing AI Connection...")

@app.websocket_route("/ws")
async def websocket_endpoint(websocket: WebSocket):
    try:
        await websocket.accept()
        clip_class = Clip_Instance()
        artefact_drawer = Drawer(clip_class, websocket)
        exemplar_drawers = []
    except Exception as e:
        logging.error("Bad socket")

    try:
        while True:
            try:
                data = await websocket.receive_json()
                logging.info(data)
            except RuntimeError:
                logging.warning("Unexpected json received by socket")
                await artefact_drawer.stop()
                del artefact_drawer
                for drawer in exemplar_drawers:
                    logging.info("Suspend Brainstorm")
                    await drawer.stop()
                    del drawer

            if data["status"] == "draw":
                artefact_drawer.draw(data)
                artefact_drawer.run_async()

            if data["status"] == "redraw":
                artefact_drawer.redraw()
                artefact_drawer.run_async()

            if data["status"] == "add_new_exemplar":
                new_exemplar = Drawer(clip_class, websocket, data["data"]["sketch_index"])
                exemplar_drawers.append(new_exemplar)
                new_exemplar.frame_size = data["data"]['frame_size']
                new_exemplar.draw(data)
                new_exemplar.run_async()

            if data["status"] == "continue_sketch":
                artefact_drawer.continue_update_sketch(data)
                artefact_drawer.run_async()

            if data["status"] == "continue_single_sketch":
                for drawer in exemplar_drawers:
                    if drawer.sketch_reference_index == data["data"]['sketch_index']:
                        drawer.continue_update_sketch(data, True)
                        drawer.run_async()

            if data["status"] == "prune":
                artefact_drawer.prune()
                for drawer in exemplar_drawers:
                    drawer.prune()
                    drawer.render_and_save(drawer.iteration, drawer.losses['global'])

            if data["status"] == "stop_single_sketch":
                for drawer in exemplar_drawers:
                    if drawer.sketch_reference_index == data["data"]['sketch_index']:
                        await drawer.stop()
                        del drawer

            if data["status"] == "stop":
                await artefact_drawer.stop()
                for drawer in exemplar_drawers:
                    logging.info("Pausing Brainstorm")
                    await drawer.stop() #don't del because may restart

    except WebSocketDisconnect:
        # await artefact_drawer.stop()
        del artefact_drawer
        for drawer in exemplar_drawers:
            # await drawer.stop()
            del drawer
            # suspend tasks
        logging.info("Client disconnected")

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
