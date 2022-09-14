//heroku
// const http = "https://";
// const base = "vector-logging-server.herokuapp.com";
// const base = "localhost:8000";

const http = "http://";
const base = "0.0.0.0:8000";
let socket = false;

const connect = () => {
    const connection = new WebSocket("ws://" + base + "/ws");
    connection.onclose = (event) => {
        console.log("Closed socket... Running without AI\n" + event);
        socketLight.style.background = "#f6ab2a";
    };
    connection.onopen = (event) => {
        console.log("Connected AI Socket\n" + event);
        socket = true;
        socketLight.style.background = "#00d457";
    };
    connection.onmessage = (event) => {
        try {
            loadResponse(JSON.parse(event.data));
        } catch (e) {
            if ((event.data.match(/{/g) || []).length > 1) {
                console.log("Parsing Concurrent JSON events");
            }
            console.log("Cooked ", e);
            controller.clipDrawing = false;
        }
    };
    connection.onerror = (err) => {
        console.error("Socket encountered error: ", err.message, "Closing socket");
        ws.close();
    };
    return connection;
};

async function postData(url = "", data = {}) {
    const response = await fetch(url, {
        method: "POST",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json",
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
    });
    return response.json();
}

const logEventAPI = (latestJson) => {
    console.log(latestJson);
    postData(http + base + "/save_interactions", latestJson)
        .then((res) => console.log(res))
        .catch((e) => console.error(e));
};

const ws = connect();