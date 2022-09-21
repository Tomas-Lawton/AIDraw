const actions = document.querySelectorAll(".clip-actions>div");
const [drawButton, focusButton, exploreButton, stopButton] = actions;

drawButton.addEventListener("click", () => drawLogic());
focusButton.addEventListener("click", () => focusLogic());
stopButton.addEventListener("click", () => stopLogic());
exploreButton.addEventListener("click", () => exploreLogic());

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
        case "frame":
            setModeFrame();
            hint.innerHTML = `Creating prompt frames will give the AI context`;
            break;
        case "active-frame":
            setModeActiveFrame();
            break;
    }
    console.log(`%c Status: ${state}`, `color:green`);
    controller.drawState = state;
};

const setModeDefault = () => {
    drawButton.className = "action-default";
    focusButton.className = "action-default";
    exploreButton.className = "action-default";
    stopButton.className = "action-inactive";
    actions.forEach((button) => button.classList.add("tooltip"));

    document.querySelector(".project").classList.remove("greeeeeen");
    accordionItem.classList.remove("inactive-section");

    // hide(explorerPanel);
    frameDropIn[0].style.display = "initial";
    frameDropIn[1].style.display = "flex";

    canvas.classList.remove("loading-canvas");
    document.getElementById("loading").style.display = "none";
    // document.querySelector(".control-lines").style.display = "block";
    undoButton.classList.remove("inactive-section");
    redoButton.classList.remove("inactive-section");
    hint.innerHTML = `Draw with AI by adding a prompt and clicking draw.`;
    sketchHistory.historyHolder.length > 1 &&
        (historyBlock.style.display = "block");

    document.querySelector(".current-status").style.color = "#A0A0A0";
    document.querySelector(".current-status").innerHTML = "Inactive";
};

const setModeDraw = () => {
    exploreButton.className = "action-inactive";
    drawButton.className = "action-active";
    hint.innerHTML = `Don't wait. Draw with me!`;
    focusButton.className = "action-default";
    stopButton.className = "action-stop";
    actions.forEach((button) => button.classList.add("tooltip"));

    document.querySelector(".project").classList.remove("greeeeeen");
    accordionItem.classList.remove("inactive-section");

    hide(explorerPanel);
    frameDropIn[0].style.display = "initial";
    frameDropIn[1].style.display = "flex";

    accordionItem.classList.add("open");
    accordionItem.classList.remove("closed");
    undoButton.classList.add("inactive-section");
    redoButton.classList.add("inactive-section");
    document.getElementById("loading").style.display = "flex";
    // document.querySelector(".control-lines").style.display = "none";

    document.querySelector(".current-status").style.color = "#00e900";
    document.querySelector(".current-status").innerHTML = "Drawing";
};

const setModeExplore = () => {
    exploreButton.className = "action-active";
    drawButton.className = "action-inactive";
    focusButton.className = "action-inactive";
    stopButton.className = "action-stop";
    actions.forEach((button) => button.classList.add("tooltip"));

    hint.innerHTML = `View creative possibilities in the explorer`;
    hide(historyBlock);

    show(explorerPanel);
    frameDropIn.forEach((button) => hide(button));

    accordionItem.classList.add("open");
    accordionItem.classList.remove("closed");
    undoButton.classList.add("inactive-section");
    redoButton.classList.add("inactive-section");
    document.getElementById("loading").style.display = "flex";
    // document.querySelector(".control-lines").style.display = "none";

    document.querySelector(".current-status").style.color = "#00e900";
    document.querySelector(".current-status").innerHTML = "Exploring";
};

const setModeFrame = () => {
    drawButton.className = "action-default";
    focusButton.className = "action-focus";
    exploreButton.className = "action-inactive";
    stopButton.className = "action-inactive";
    actions.forEach((button) => button.classList.add("tooltip"));

    document.querySelector(".project").classList.add("greeeeeen");
    accordionItem.classList.add("inactive-section");

    frameDropIn.forEach((button) => hide(button));
    undoButton.classList.add("inactive-section");
    redoButton.classList.add("inactive-section");

    accordionItem.classList.remove("open");
    accordionItem.classList.add("closed");
    hint.innerHTML = `Creating prompt frames will give the AI context`;

    hide(pickerSelect);
    hide(explorerPanel);

    frameName.innerHTML = `Creating focus frames the prompt: ${controller.prompt}`;
    prompt.focus();

    document.querySelector(".current-status").style.color = "#A0A0A0";
    document.querySelector(".current-status").innerHTML = "Framing";
};

const setModeActiveFrame = () => {
    drawButton.className = "action-active";
    focusButton.className = "action-focus";
    exploreButton.className = "action-inactive";
    stopButton.className = "action-stop";
    actions.forEach((button) => button.classList.add("tooltip"));

    frameDropIn.forEach((button) => hide(button));

    document.querySelector(".project").classList.add("greeeeeen");
    accordionItem.classList.add("inactive-section");

    hint.innerHTML = `Creating prompt frames will give the AI context`;

    undoButton.classList.add("inactive-section");
    redoButton.classList.add("inactive-section");

    hide(pickerSelect);
    hide(explorerPanel);

    frameName.innerHTML = `Creating focus frames the prompt: ${controller.prompt}`;
    prompt.focus();

    document.querySelector(".current-status").style.color = "#00e900";
    document.querySelector(".current-status").innerHTML = "Drawing";
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
    if (socket) {
        if (controller.drawState === "frame") {
            setActionState("active-frame");
        } else {
            setActionState("draw");
        }
        controller.draw();
        mainSketch.svg = paper.project.exportSVG({
            asString: true,
        });
        logger.event("start-drawing");
    }
};

const focusLogic = () => {
    switch (controller.drawState) {
        case "inactive":
            setActionState("frame");
            mainSketch.frameLayer.activate();
            setPenMode("local");
            show(localPrompts);
            hide(styles);
            activateCanvasFrames();
            break;
        case "draw":
            setActionState("active-frame");
            mainSketch.frameLayer.activate();
            setPenMode("local");
            show(localPrompts);
            hide(styles);
            activateCanvasFrames();
            break;
        case "frame":
            setActionState("inactive");
            mainSketch.sketchLayer.activate();
            setPenMode("pen");
            hide(localPrompts);
            show(styles);
            frameName.innerHTML = `I'm drawing "${controller.prompt}"`;
            deactivateCanvasFrames();
            break;
        case "active-frame":
            setActionState("draw");
            mainSketch.sketchLayer.activate();
            setPenMode("pen");
            hide(localPrompts);
            show(styles);
            deactivateCanvasFrames();
            break;
    }
};

const exploreLogic = () => {
    if (socket) {
        if (noPrompt()) {
            openModal({
                title: "Type a prompt first!",
                message: "You need a target for AI sketchs.",
                confirmAction: () => (controlPanel.style.display = "flex"),
            });
            return;
        } else {
            sketchHistory.historyHolder.push({
                svg: mainSketch.svg,
                loss: mainSketch.semanticLoss,
            });
            sketchHistory.pushUndo();
            generateExploreSketches();
        }
    }
};

const stopLogic = () => {
    if (controller.drawState === "active-frame") {
        setActionState("inactive");
        controller.stop(); //flag
    } else if (controller.drawState === "explore") {
        removeExploreSketches();
        controller.clipDrawing = false;
        setActionState("inactive");
        logger.event("stop-exploring");
    } else {
        if (controller.drawState === "pause") {
            controller.liveCollab = false;
        }
        controller.stop(); //flag
        controller.clipDrawing = false;
        mainSketch.svg = paper.project.exportSVG({
            asString: true,
        });
        setActionState("inactive");
        logger.event("stop-drawing");
    }
};