import logging
import os
import uvicorn

# from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from drawer import CICADA
from clip_instance import Clip_Instance


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
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    cluster = MongoClient(os.environ.get('MONGODB_URI'))
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
            {"log_time": interaction_json["log_time"]},  # Log mode
            {
                "$set": {
                    "user_id": interaction_json["user_id"],
                    "recorded_data": interaction_json["recorded_data"],
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


def kill(d, a):
    a.is_running = False
    for drawer in d:
        drawer.is_running = False
        del drawer


if not os.environ.get('CONNECTAI') == "True":
    logging.info("Running without AI")
else:
    logging.info("Establishing Connection...")
    clip_class = Clip_Instance()
    exemplar_drawers = []

    @app.websocket_route("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        try:
            await websocket.accept()
        except Exception as e:
            logging.error("Bad socket")

        main_sketch = CICADA(clip_class, websocket)

        try:
            while True:
                try:
                    data = await websocket.receive_json()
                    logging.info(data)
                except RuntimeError:
                    logging.warning("Unexpected json received by socket")
                    await main_sketch.stop()
                    del main_sketch
                    for drawer in exemplar_drawers:
                        logging.info("Suspend Brainstorm")
                        await drawer.stop()
                        del drawer

                if data["status"] == "draw":
                    main_sketch.draw(data)
                    main_sketch.activate(True)
                    main_sketch.run_async()

                if data["status"] == "add_new_sketch":
                    new_exemplar = CICADA(
                        clip_class, websocket, data["data"]["sketch_index"]
                    )
                    exemplar_drawers.append(new_exemplar)
                    new_exemplar.draw(data)
                    main_sketch.activate(True)
                    new_exemplar.run_async()

                if data["status"] == "continue_sketch":
                    main_sketch.continue_update_sketch(data)
                    main_sketch.activate(False)
                    main_sketch.run_async()

                if data["status"] == "prune":
                    main_sketch.prune()
                    await main_sketch.render_client(main_sketch.iteration, main_sketch.losses["global"], True)

                if data["status"] == "stop_single_sketch":
                    for drawer in exemplar_drawers:
                        if (
                            drawer.sketch_reference_index
                            == data["data"]['sketch_index']
                        ):
                            await drawer.stop()
                            del drawer

                if data["status"] == "stop":
                    await main_sketch.stop()

        except WebSocketDisconnect:
            kill(exemplar_drawers, main_sketch)
            logging.info("Client disconnected")
        except KeyboardInterrupt:
            kill(exemplar_drawers, main_sketch)
            logging.info("Client killed")


if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
