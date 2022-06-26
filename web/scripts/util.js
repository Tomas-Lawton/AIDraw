if (useAI) {
    ws.onmessage = function(event) {
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
}

const scaleSelectGroup = (g, s) => {
    g.scaling = s;
    hideSelectUI(false);
    let items = getSelectedPaths();
    fitToSelection(items, "scaling");
    updateSelectUI();
};

const rotateSelectGroup = (g, r) => {
    g.rotation = r;
    hideSelectUI(false);
    let items = getSelectedPaths();
    fitToSelection(items, "rotating");
    updateSelectUI();
};

const scaleGroup = (group, to) => {
    group.scale(to, new Point(0, 0));
    group.children.forEach((item) => {
        item.strokeWidth *= to;
    });
    return group;
};

const setPointSize = (s) => {
    const point = document.getElementById("point-size");
    controller.strokeWidth = s;
    point.style.width = controller.strokeWidth + "px";
    point.style.height = controller.strokeWidth + "px";
    getSelectedPaths().forEach(
        (item) => (item.strokeWidth = controller.strokeWidth)
    );
};

const ungroup = () => {
    if (controller.transformGroup !== null) {
        controller.transformGroup.applyMatrix = true;
        userLayer.insertChildren(
            controller.transformGroup.index,
            controller.transformGroup.removeChildren()
        );
        controller.transformGroup.remove();
        controller.transformGroup = null;
    }
};

const fitToSelection = (items, state) => {
    let bbox = items.reduce((bbox, item) => {
        return !bbox ? item.bounds : bbox.unite(item.bounds);
    }, null);
    // Add stroke width so no overflow over bounds?
    // Also shouldn't set the boundingBox, should set boundingBox.bounds ???
    controller.boundingBox = new Path.Rectangle(bbox);
    controller.boundingBox.sendToBack();
    controller.boundingBox.set({
        fillColor: "#f5f5f5",
        opacity: 0.4,
        strokeColor: "#7b66ff",
        strokeWidth: 2,
    });
    controller.boundingBox.data.state = state;
    return controller.boundingBox;
};

const getSelectedPaths = () =>
    userLayer.getItems().filter((path) => path.selected);

const noPrompt = () =>
    controller.prompt === "" ||
    controller.prompt === null ||
    controller.prompt === prompt.getAttribute("placeholder");

// const switchControls = () => {
//     if (controller.buttonControlLeft) {
//         console.log(window.innerWidth);
//         buttonPanel.style.left = `${window.innerWidth - buttonPanel.offsetWidth}px`;
//     } else {
//         buttonPanel.style.left = 0;
//     }
//     controller.buttonControlLeft = !controller.buttonControlLeft;
// };

const deletePath = () => {
    // Save
    hideSelectUI();
    ungroup();
    let g = getSelectedPaths();
    g.forEach((path) => {
        path.selected = false;
    });
    controller.stack.undoStack.push({
        type: "delete-event",
        data: userLayer.exportJSON(),
    });

    // Delete
    mainSketch.userPathList = mainSketch.userPathList.filter(
        (ref) => !g.includes(ref)
    );
    g.forEach((path) => path.remove());

    // Save new SVG
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });

    if (liveCollab) {
        controller.continueSketch();
        liveCollab = false;
    }
    logger.event("deleted-path");
};

const showHide = (item) => {
    if (item.style.display === "flex" || item.style.display === "") {
        item.style.display = "none";
    } else {
        item.style.display = "flex";
    }
};

const getHistoryBatch = (maxSize, startIdx) => {
    let len = controller.stack.historyHolder.length;
    if (len <= 1) return null;
    let traceList = [];
    let batchSize = Math.min(maxSize, startIdx); // not first item

    for (let i = 0; i < batchSize; i++) {
        // num traces
        traceList.push(controller.stack.historyHolder[startIdx - i - 1]);
    }
    return traceList;
};

const calcRollingLoss = () => {
    const items = getHistoryBatch(
        setTraces.value,
        controller.stack.historyHolder.length - 1
    );
    if (items) {
        const sum = items.reduce(
            (partialSum, historyItem) => partialSum + historyItem.loss,
            0
        );
        const newRollingLoss = sum / items.length;
        controller.lastRollingLoss = newRollingLoss;
    }
};

const showTraceHistoryFrom = (fromIndex) => {
    const items = getHistoryBatch(controller.numTraces, fromIndex);
    if (items) {
        controller.traces = null;
        let refList = [];
        for (let stored of items) {
            userLayer.importSVG(stored.svg);
            refList.push(mainSketch.load(1, stored.svg, stored.num));
        }
        controller.traces = refList;
    }
};

const incrementHistory = () => {
    controller.stack.historyHolder.push({
        svg: mainSketch.svg,
        num: mainSketch.userPathList.length,
    });
    timeKeeper.setAttribute("max", String(controller.step + 1));
    timeKeeper.value = String(controller.step + 1);
    setTraces.setAttribute("max", String(controller.step + 1));
    controller.step += 1;
};

const updateMain = (result) => {
    incrementHistory();
    if (controller.numTraces > 1) {
        showTraceHistoryFrom(controller.stack.historyHolder.length - 1);
    } else {
        controller.lastRender = mainSketch.load(
            frame / 224,
            result.svg,
            mainSketch.userPathList.length,
            true,
            true
        );
        mainSketch.svg = mainSketch.useLayer.exportSVG();
    }
    // calcRollingLoss();
};

const loadResponse = (result) => {
    console.log("Result: ", result);

    if (controller.clipDrawing) {
        // Main
        if (result.status === "None") {
            updateMain(result);
        }

        // Explore
        var matches = result.status.match(/\d+/g); //if status is a num
        if (matches != null) {
            if (result.svg === "") return null;
            let sketch = controller.sketches[result.sketch_index];
            sketch.load(
                sketchSize / 224,
                result.svg,
                mainSketch.userPathList.length,
                sketch.userLayer
            );
        }

        // Prune Main
        if (controller.drawState == "pruning") {
            updateMain(result);
            setActionUI("stop-prune");
            controller.clipDrawing = false; //single update
        }
    }
};

const getRGBA = () => {
    let rgba = controller.strokeColor.replace(/[^\d,]/g, "").split(",");
    rgba[3] = controller.opacity;
    return `rgba(${rgba.join()})`;
};

const setLineLabels = (layer) => {
    let res = controller.maxCurves - layer.children.length;
    controller.addLines = res > 0 ? res : 0;
    document.getElementById(
        "max-lines"
    ).innerHTML = `Lines : ${controller.maxCurves}`;
    document.getElementById(
        "calc-lines"
    ).innerHTML = `Add : ${controller.addLines}`;
};

const createGroup = (items) => {
    rotateSlider.value = 0;
    rotateNumber.value = 0;
    scaleSlider.value = 10;
    scaleSlider.value = 10;
    controller.transformGroup = new Group({
        children: items,
        strokeScaling: false,
        transformContent: false,
    });
};

const download = () => {
    // REMOVE REFs to select box
    // to do: refactor these.
    userLayer.getItems().forEach((path) => {
        path.selected = false;
    });

    canvas.toBlob((blob) => {
        let url = window.URL || window.webkitURL;
        let link = url.createObjectURL(blob);
        let isIE = false || !!document.documentMode;
        if (isIE) {
            window.navigator.msSaveBlob(blob, fileName);
        } else {
            let a = document.createElement("a");
            a.setAttribute("download", "sketch.png");
            a.setAttribute("href", link);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    });

    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
    logger.event("save-sketch");

    if (!useAI) {
        location.reload();
    }
};