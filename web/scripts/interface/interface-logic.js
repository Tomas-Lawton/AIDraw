const killExploratorySketches = () => {
    console.log(controller.exploreScopes);
    if (controller.exploreScopes.length > 0) {
        explorerPanel.firstElementChild.childNodes.forEach((child, i) => {
            let stopButton = child.querySelector(".fa-hand");
            let loader = child.querySelector(".card-loading");
            loader.classList.remove("button-animation");
            loader.classList.remove("fa-spinner");
            loader.classList.add("fa-check");
            stopButton.style.background = "#f5f5f5";
            stopButton.style.background = "#d2d2d2";
            controller.stopSingle(controller.exploreScopes[i]);
        });
        controller.exploreScopes = [];
    }
};

const generateExploreSketches = () => {
    // To do: make sketches fit in place holder rather than replace

    // Remove the place holder ones
    total = 4;
    for (let i = 0; i < 4; i++) {
        explorerPanel.firstElementChild.removeChild(
            explorerPanel.firstElementChild.firstElementChild
        );
    }
    // Replace
    for (let i = 0; i < 4; i++) {
        let sketch = new Sketch(
            controller.sketchScopeIndex,
            sketchScope,
            sketchSize,
            "AI"
        );
        let newElem = sketch.renderMini();
        controller.exploreScopes.push(controller.sketchScopeIndex);
        explorerPanel.firstElementChild.appendChild(newElem);
        controller.newExploreSketch(controller.sketchScopeIndex);
        controller.sketchScopeIndex += 1;
    }
    controller.clipDrawing = true;
    setActionState("explore");
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
    logger.event("start-exploring");
};

const emptyExplorer = () => {
    killExploratorySketches();
    controller.clipDrawing = false;
    // refactor into function
    for (let i = 0; i < 4; i++) {
        if (explorerPanel.firstElementChild) {
            explorerPanel.firstElementChild.removeChild(
                explorerPanel.firstElementChild.firstChild
            );
            let sketch = new Sketch(null, defaults, sketchSize);
            let newElem = sketch.renderMini();
            explorerPanel.firstElementChild.appendChild(newElem);
            newElem.classList.add("inactive-sketch");
        }
    }
};

const deleteFrame = (i) => {
    let item = mainSketch.localFrames[i];
    item.tag.remove();
    item.frame.remove();
    item.paperFrame.remove();
    delete mainSketch.localFrames[i];
    if (Object.keys(mainSketch.localFrames).length === 0) {
        document.getElementById("prompt-info").style.display = "initial";
    }
};

const inactiveStopUI = () => {
    stopButton.classList.add("inactive-action");
    stopButton.style.background = "#f5f5f5";
    stopButton.style.color = "#d2d2d2";
    stopButton.querySelector("i").style.color = "#d2d2d2";
    stopButton.style.cursor = "default";
};

const inactiveFocusUI = () => {
    focusButton.style.background = "#f3f1ff";
    focusButton.style.color = "#7b66ff";
    focusButton.querySelector("i").style.color = "#7b66ff";
    focusButton.style.cursor = "default";
};

const setThisColor = (rgba) => {
    document.getElementById("point-size").style.background = rgba;
    // document.querySelector(".tool-color").style.background = rgba;
    document.getElementById(
        "stroke-dot"
    ).style.boxShadow = `inset 7px 10px 12px 7px ${getRGBA(0.2)}`;
    document.querySelector(
        ".tool-view"
    ).style.boxShadow = `inset 7px 10px 12px 7px ${getRGBA(0.2)}`;

    document
        .querySelectorAll(".tool-view .main-color")
        .forEach((elem) => (elem.style.fill = rgba));
    console.log(controller.strokeColor);
    document
        .querySelectorAll(".tool-view .second-color")
        .forEach(
            (elem) =>
            (elem.style.fill = RGB_Linear_Blend(
                0.3,
                controller.strokeColor,
                "rgba(255, 255, 255, 1)"
            ))
        );

    // set active tool colors
    // set the background

    if (controller.transformGroup) {
        controller.transformGroup.children.forEach(
            (child) => (child.strokeColor = rgba)
        );
    }
};

const setAlpha = (a) => {
    a = a.toFixed(2);
    let rgba = getRGBA(a);
    controller.alpha = a;
    controller.strokeColor = rgba;
    setThisColor(rgba);
    alphaSlider.value = a;
    // setPenMode("pen", pen);
};

const setMouseOver = () => {
    var div = document.getElementById("stroke-dot");
    div.mouseIsOver = false;
    div.onmouseover = function() {
        this.mouseIsOver = true;
    };
    div.onmouseout = function() {
        this.mouseIsOver = false;
    };
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
    sendToBack.style.display = "none";
    moveUp.style.display = "none";
    copyHandler.style.display = "none";
    fixedHandler.style.display = "none";
};

const updateRectBounds = (from, to) => {
    controller.boundingBox.bounds = new Rectangle(from, to);
    controller.boundingBox.bounds.set({
        fillColor: "#f5f5f5",
        strokeColor: "#7b66ff",
        opacity: 0.4,
        strokeWidth: 2,
    });
    controller.boundingBox.data.state = "resizing";
    updateSelectPosition();
};

const updateSelectPosition = () => {
    let center = deleteHandler.getBoundingClientRect().height / 2 + 5;

    if (controller.boundingBox.bounds.width > 65) {
        deleteHandler.style.left = controller.boundingBox.bounds.topRight.x + "px";
        deleteHandler.style.top = controller.boundingBox.bounds.top - center + "px";
    } else {
        deleteHandler.style.left = controller.boundingBox.bounds.center.x + "px";
        deleteHandler.style.top =
            controller.boundingBox.bounds.bottom + center + "px";
    }

    copyHandler.style.top = controller.boundingBox.bounds.top - center + "px";
    copyHandler.style.left = controller.boundingBox.bounds.topLeft.x + "px";

    moveUp.style.left = controller.boundingBox.bounds.topLeft.x + "px";
    moveUp.style.top = controller.boundingBox.bounds.bottom + center + "px";

    sendToBack.style.top = controller.boundingBox.bounds.bottom + center + "px";
    sendToBack.style.left = controller.boundingBox.bounds.topRight.x + "px";

    fixedHandler.style.top =
        controller.boundingBox.bounds.top - center - 5 + "px";
    fixedHandler.style.left = controller.boundingBox.bounds.center.x + "px";
};

const updateFixedUI = () => {
    let i = fixedHandler.querySelector("i");
    if (isFixedGroup()) {
        i.classList.remove("fa-minimize");
        i.classList.add("fa-check");
        i.classList.add("green");
        i.classList.remove("orange");
    } else {
        i.classList.add("fa-minimize");
        i.classList.remove("fa-check");
        i.classList.add("orange");
        i.classList.remove("green");
    }
};

const updateSelectUI = () => {
    if (controller.boundingBox && getSelectedPaths().length) {
        if (controller.boundingBox.bounds.width > 65) {
            sendToBack.style.display = "block";
            moveUp.style.display = "block";
            copyHandler.style.display = "block";
        }
        fixedHandler.style.display = "block";

        deleteHandler.style.display = "block";
        transformControl.style.display = "flex";
        updateFixedUI();
        updateSelectPosition();
    }
};

const openModal = (data) => {
    if (data.hasOwnProperty("ui")) {
        modalContent.innerHTML = null;
        data.ui.style.display = "flex";
        modalContent.appendChild(data.ui);
    } else {
        if (modalContent.firstChild) {
            modalContent.firstChild.style.display = "none";
            document.body.appendChild(modalContent.firstChild); //store on body
        }
        modalContent.innerHTML = null;
    }

    let cancel = () =>
        data.hasOwnProperty("cancelAction") ?
        data.cancelAction() :
        (modal.style.display = "none");
    let confirm = () =>
        data.hasOwnProperty("confirmAction") ?
        data.confirmAction() :
        (modal.style.display = "none");
    let close = () => cancel();

    document.getElementById("modal-title").innerHTML = data.title;
    document.getElementById("modal-message").innerHTML = data.message;
    document.getElementById("cancel-modal").onclick = () => cancel();
    document.getElementById("modal-cross").onclick = () => close();
    document.getElementById("confirm-modal").onclick = () => {
        confirm();
        close();
    };
    modal.style.display = "block";
};

const showHide = (item) => {
    if (item.style.display === "flex" || item.style.display === "") {
        item.style.display = "none";
    } else {
        item.style.display = "flex";
    }
};

const show = (item) => {
    item.style.display = "flex";
};

const hide = (item) => {
    item.style.display = "none";
};

const setLineLabels = (layer) => {
    let res = controller.maxCurves - layer.children.length;
    controller.addLines = res > 0 ? res : 0;
    document.getElementById(
        "max-lines"
    ).innerHTML = `Total Lines: ${controller.maxCurves}`;
    document.getElementById(
        "calc-lines"
    ).innerHTML = `Adding: ${controller.addLines}`;
};

const setDefaultTransform = () => {
    rotateSlider.value = 0;
    rotateNumber.value = 0;
    scaleSlider.value = 10;
    scaleSlider.value = 10;
};