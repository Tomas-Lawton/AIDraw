const actions = document.querySelectorAll(".clip-actions>div");
const [drawButton, exploreButton, stopButton] = actions;

drawButton.addEventListener("click", () => drawLogic());
stopButton.addEventListener("click", () => stopLogic());
exploreButton.addEventListener("click", () => {
    if (explorerPanel.style.display === "flex") {
        hide(explorerPanel)
    } else {
        if (noPrompt()) {
            openModal({
                title: "What are we drawing?",
                message: "Without a prompt, the AI doesn't know what to draw!",
            });
            return;
        } else {
            show(explorerPanel)
            dimensionInputs[0].focus()
        }
    }
});

generateButton.addEventListener("click", () => {
    if (controller.drawState !== "explore") {
        exploreLogic()
    } else {
        setActionState("inactive")
        controller.clipDrawing = false;
        socket.send(JSON.stringify({ status: "stop_explorer" }))
    }
});

const setActionState = (state) => {
    switch (state) {
        case "inactive":
            setModeDefault();
            break;
        case "draw":
            setModeDraw();
            break;
        case "explore":
            setModeExplore();
            break;
    }
    console.log(`%c Status: ${state}`, `color:green`);
    controller.drawState = state;
};

const setModeDefault = () => {
    let loaders = diverseSketcheContainer.querySelectorAll(".card-loading").forEach(elem => {
        elem.classList.remove("button-animation");
        elem.classList.remove("fa-spinner");
        elem.classList.add("fa-check");
    });

    loadingBar.style.display = "none"
    drawButton.className = "action-default"
    exploreButton.className = "action-default";
    stopButton.className = "action-inactive";
    generateButton.classList = controller.behaviours["d0"]["name"] === "" ? "action-inactive" : "action-default";
    generateButton.innerHTML = "Generate"
    actions.forEach((button) => button.classList.add("tooltip"));

    accordionItem.classList.add("open");
    accordionItem.classList.remove("closed");

    prompt.classList.remove("inactive-prompt");
    document.querySelector(".project").classList.remove("greeeeeen");

    canvas.classList.remove("loading-canvas");
    // document.querySelector(".control-lines").style.display = "block";
    undoButton.classList.remove("inactive-section");
    redoButton.classList.remove("inactive-section");
    hint.innerHTML = `Draw with AI by adding a prompt and clicking draw.`;
    if (sketchHistory.historyHolder.length > 2) {
        show(historyBlock);
        body.style.maxHeight = body.scrollHeight + "px";
    } // 2 because stop also has event

    document.querySelector(".current-status").style.color = "#A0A0A0";
    document.querySelector(".current-status").innerHTML = "Inactive";
};

const setModeDraw = () => {
    exploreButton.className = "action-inactive";
    drawButton.className = "action-current";
    hint.innerHTML = `Don't wait. Draw with me!`;
    stopButton.className = "action-stop";
    stopButton.classList.remove("action-inactive")
    actions.forEach((button) => button.classList.add("tooltip"));

    prompt.classList.add("inactive-prompt")
    document.querySelector(".project").classList.remove("greeeeeen");

    hide(explorerPanel);
    hide(historyBlock);

    accordionItem.classList.add("open");
    accordionItem.classList.remove("closed");
    undoButton.classList.add("inactive-section");
    redoButton.classList.add("inactive-section");
    // document.querySelector(".control-lines").style.display = "none";

    document.querySelector(".current-status").style.color = "#7b66ff";
    document.querySelector(".current-status").innerHTML = "Drawing";
};


const setModeExplore = () => {
    loadingBar.style.display = "flex"
    generateButton.innerHTML = "Stop"
    // exploreButton.className = "action-current";
    stopButton.className = "action-inactive";
    generateButton.className = "action-stop";
    actions.forEach((button) => button.classList.add("tooltip"));

    prompt.classList.add("inactive-prompt")
    hint.innerHTML = `View creative possibilities in the explorer`;
    hide(historyBlock);
    show(explorerPanel);

    undoButton.classList.add("inactive-section");
    redoButton.classList.add("inactive-section");
    // document.querySelector(".control-lines").style.display = "none";

    document.querySelector(".current-status").style.color = "#7b66ff";
    document.querySelector(".current-status").innerHTML = "Exploring";
};

const activateCanvasFrames = () => {
    for (const item in mainSketch.localFrames) {
        let frameItem = mainSketch.localFrames[item];
        frameItem.frame.querySelectorAll("i").forEach((icon) => show(icon));
        show(frameItem.frame.querySelector("div"));
        frameItem.frame
            .querySelector("input")
            .classList.remove("frame-label-inactive");
        frameItem.frame.querySelector("input").classList.add("frame-label-active");
        frameItem.paperFrame.set(frameOptions);
    }
};

const deactivateCanvasFrames = () => {
    for (const item in mainSketch.localFrames) {
        let frameItem = mainSketch.localFrames[item];
        frameItem.frame.querySelectorAll("i").forEach((icon) => hide(icon));
        hide(frameItem.frame.querySelector("div"));
        frameItem.frame
            .querySelector("input")
            .classList.remove("frame-label-active");
        frameItem.frame
            .querySelector("input")
            .classList.add("frame-label-inactive");
        frameItem.paperFrame.set({
            fillColor: "rgba(226,226,226,0)",
            strokeColor: "rgba(180, 180, 180, 0.8)",
        });
    }
};


const drawLogic = () => {
        if (noPrompt()) {
            openModal({
                title: "Type a prompt first!",
                message: "You need a target for AI sketching.",
                confirmAction: () => (controlPanel.style.display = "flex"),
            });
            return;
        }

    if (socket) {
        setActionState("draw");
        controller.draw();
        logger.event("start-drawing");
    }
};


const exploreLogic = () => {
    if (!dimensionInputs[0].value) {
        openModal({
            title: "Add dimensions",
            message: "Add at least one dimension to explore options.",
        });
        return;
    }

    sketchHistory.historyHolder.push({
        svg: mainSketch.svg,
        loss: mainSketch.semanticLoss,
    });
    sketchHistory.pushUndo();
    setActionState("explore");
    removeSketches();
    generateExploreSketches();
};

const stopLogic = () => {
    controller.clipDrawing = false;
    if (controller.drawState === "explore") {
        logger.event("stop-exploring");
    } 
    if (controller.drawState === "draw") {
        socket.send(JSON.stringify({ status: "stop" }))
        logger.event("stop-drawing");
    }
    setActionState("inactive");
    console.log(controller.drawState)
};