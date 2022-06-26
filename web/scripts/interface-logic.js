const killExploratorySketches = () => {
    explorer.childNodes.forEach((child, i) => {
        let stopButton = child.querySelector(".fa-stop");
        let loader = child.querySelector(".card-loading");

        loader.classList.remove("button-animation");
        loader.classList.remove("fa-spinner");
        loader.classList.add("fa-check");
        stopButton.style.background = "#f5f5f5";
        stopButton.style.background = "#d2d2d2";
        controller.stopSingle(controller.inspireScopes[i]);
    });
};

const redStop = () => {
    stopButton.classList.remove("inactive-action");
    stopButton.style.background = "#ff6060";
    stopButton.style.color = "#ffffff";
    stopButton.querySelector("i").style.color = "#ffffff";
    stopButton.style.cursor = "pointer";
};

const inactiveStop = () => {
    stopButton.classList.add("inactive-action");
    stopButton.style.background = "#f5f5f5";
    stopButton.style.color = "#d2d2d2";
    stopButton.querySelector("i").style.color = "#d2d2d2";
    stopButton.style.cursor = "default";
};

const drawingFinished = () => {
    canvas.classList.remove("loading-canvas");
    actionControls.forEach((elem) => {
        elem.classList.remove("inactive-action");
        // elem.classList.remove("active");
    });
    document.getElementById("spinner").style.display = "none";
    document.getElementById("control-lines").style.display = "block";

    promptInput.style.display = "flex";
    // document.getElementById("add-refine").style.display = "none";
    document.getElementById("lasso").classList.remove("inactive-top-action");
    document.getElementById("undo").classList.remove("inactive-top-action");
    document.getElementById("redo").classList.remove("inactive-top-action");
    inactiveStop();
};

const setActionUI = (state) => {
    let lastDrawState = controller.drawState;
    aiMessage.classList.remove("typed-out");

    if (state == "pruning") {
        aiMessage.classList.remove("typed-out");
        aiMessage.innerHTML = "Just a moment while I tidy up!";
        aiMessage.classList.add("typed-out");
        canvas.classList.add("loading-canvas");
        actionControls.forEach((elem) => {
            elem.classList.add("inactive-action");
            // elem.classList.remove("active");
        });
        inactiveStop();
    } else if (state == "stop-prune") {
        drawingFinished();
    } else if (controller.activeStates.includes(state)) {
        actionControls.forEach((elem) => {
            elem.classList.add("inactive-action");
            // elem.classList.remove("active");
        });
        redStop();
        document.getElementById("lasso").classList.add("inactive-top-action");
        document.getElementById("undo").classList.add("inactive-top-action");
        document.getElementById("redo").classList.add("inactive-top-action");

        promptInput.style.display = "none";
        document.getElementById("spinner").style.display = "flex";

        // document.getElementById("add-refine").style.display = "block";
        // document.getElementById("respect-block").classList.add("inactive-section");

        if (state == "drawing") {
            aiMessage.innerHTML = `Got it! Drawing ${controller.prompt}!`;
            // sketchBook.style.display = "flex";
            // document.getElementById("scrapbook").classList.add("panel-open");
            // document.getElementById("draw").classList.add("active");
        } else if (state == "explore") {
            aiMessage.innerHTML = `I've got some ideas for ${controller.prompt}!`;
            // canvas.classList.add("loading-canvas");
            document.getElementById("history-block").style.display = "none";
            document.getElementById("explore-margin").style.display = "flex";
            // document.getElementById("inspire").classList.add("active");
        } else if (state == "continuing" || state == "continue-explore") {
            aiMessage.innerHTML = `I'll make that it into ${controller.prompt}.`;
        }
        aiMessage.classList.add("typed-out");

        document.getElementById("control-lines").style.display = "none";
    } else if (state === "stop") {
        aiMessage.innerHTML = "All done! What should we draw next?";
        aiMessage.classList.add("typed-out");
        drawingFinished();
        if (
            controller.stack.historyHolder.length > 1 //first elem empty
        ) {
            document.getElementById("history-block").style.display = "flex";
        }
    } else if (state === "stopSingle") {
        aiMessage.innerHTML = `Stopped a single sketch!`;
        aiMessage.classList.add("typed-out");
        drawingFinished();
        controller.resetMetaControls();
    }
    controller.drawState = state;
    console.log("Set: ", state);
};

// dragging moves select elements + ui
const hideSelectUI = (includeTransform = true) => {
    // remove rect
    if (controller.boundingBox) {
        controller.boundingBox.remove();
        controller.boundingBox = null;
    }
    // hide ui
    if (includeTransform) {
        transformControl.style.display = "none";
    }
    deleteHandler.style.display = "none";
    // initialiseHandler.style.display = "none";
    // reviseHandler.style.display = "none";
    copyHandler.style.display = "none";
};

const updateRectBounds = (from, to) => {
    controller.boundingBox.bounds = new Rectangle(from, to);
    controller.boundingBox.bounds.set({
        fillColor: "#f5f5f5",
        opacity: 0.4,
        strokeColor: "#7b66ff",
        strokeWidth: 2,
    });
    controller.boundingBox.data.state = "resizing";
    updateSelectPosition();
};

const updateSelectPosition = () => {
    let uiOffset = deleteHandler.getBoundingClientRect().height / 2 + 5;
    deleteHandler.style.left = controller.boundingBox.bounds.topRight.x + "px";
    // reviseHandler.style.left =
    //     controller.boundingBox.bounds.topLeft.x + "px";
    deleteHandler.style.top = controller.boundingBox.bounds.top - uiOffset + "px";
    // reviseHandler.style.top =
    //     controller.boundingBox.bounds.top - uiOffset + "px";

    // initialiseHandler.style.left =
    //     controller.boundingBox.bounds.topRight.x + "px";
    copyHandler.style.left = controller.boundingBox.bounds.topLeft.x + "px";
    // initialiseHandler.style.top =
    //     controller.boundingBox.bounds.bottom + uiOffset + "px";
    copyHandler.style.top =
        controller.boundingBox.bounds.bottom + uiOffset + "px";
};

const updateSelectUI = () => {
    if (controller.boundingBox && getSelectedPaths().length) {
        deleteHandler.style.display = "block";
        // initialiseHandler.style.display = "block";
        // reviseHandler.style.display = "block";
        copyHandler.style.display = "block";
        transformControl.style.display = "flex";
        updateSelectPosition();
    }
};

const pauseActiveDrawer = () => {
    if (controller.activeStates.includes(controller.drawState)) {
        // TO DO: check if can just check if clip is drawing.. should work?
        liveCollab = true;
        controller.pause(); //continue on pen up
        aiMessage.classList.remove("typed-out");
        aiMessage.innerHTML = `I'mma let you finish...`;
        aiMessage.classList.add("typed-out");
    }
};