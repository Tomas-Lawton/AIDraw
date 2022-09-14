const createUUID = () => {
    var d = new Date().getTime();
    var d2 =
        (typeof performance !== "undefined" &&
            performance.now &&
            performance.now() * 1000) ||
        0; //Time in microseconds since page-load or 0 if unsupported
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16;
        if (d > 0) {
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else {
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        }
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
};

const createGroup = (items) => {
    setDefaultTransform();
    controller.transformGroup = new Group({
        children: items,
        strokeScaling: false,
        transformContent: false,
    });
    return controller.transformGroup;
};

const transformGroup = (g, t, a) => {
    g[t] = a;
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
    s = s.toPrecision(3);
    const point = document.getElementById("point-size");
    controller.strokeWidth = s;
    point.style.width = controller.strokeWidth + "px";
    point.style.height = controller.strokeWidth + "px";

    if (controller.transformGroup) {
        controller.transformGroup.getItems(
            (item) => (item.strokeWidth = controller.strokeWidth)
        );
    }

    widthSlider.value = controller.strokeWidth;
};

const ungroup = () => {
    let selected;
    if (controller.transformGroup !== null) {
        controller.transformGroup.applyMatrix = true;
        selected = controller.transformGroup.removeChildren();
        mainSketch.sketchLayer.insertChildren(
            controller.transformGroup.index,
            selected
        );
        controller.transformGroup.remove();
        controller.transformGroup = null;
    }
    hideSelectUI();
    return selected;
};

const isFixedGroup = () =>
    !controller.transformGroup.children.filter(
        (item) => !item.data.fixed || item.data.fixed === undefined
    ).length; //no ai paths

const fixGroup = (b) => {
    controller.transformGroup.getItems((item) => (item.data.fixed = b));
};

//TODO: Add stroke width so no overflow over bounds?
const fitToSelection = (items, state) => {
    let bbox = items.reduce((bbox, item) => {
        return !bbox ? item.bounds : bbox.unite(item.bounds);
    }, null);
    controller.boundingBox = new Path.Rectangle(bbox);
    controller.boundingBox.set(rectangleOptions); //outline
    controller.boundingBox.sendToBack();
    controller.boundingBox.data.state = state;
    return controller.boundingBox;
};

const getSelectedPaths = () =>
    mainSketch.sketchLayer.getItems().filter((path) => path.selected);

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

const isDeselect = (e, hitResult) => {
    // TO change to simple hit test
    let isInBounds = null;
    if (controller.boundingBox) {
        isInBounds =
            e.point.x > controller.boundingBox.bounds.left &&
            e.point.x < controller.boundingBox.bounds.right &&
            e.point.y > controller.boundingBox.bounds.top &&
            e.point.y < controller.boundingBox.bounds.bottom;
    }
    return (!hitResult && !isInBounds) || (!hitResult && isInBounds == null);
};

const deleteItems = () => {
    // Save
    let selectedPaths = ungroup();
    selectedPaths.forEach((path) => {
        path.selected = false;
    });

    sketchHistory.pushUndo();

    // Delete
    selectedPaths.forEach((path) => path.remove());

    // Save new SVG
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });

    if (controller.liveCollab) {
        controller.continueSketch();
        controller.liveCollab = false;
    }
    // logger.event("deleted-path");
};

const calcRollingLoss = () => {
    if (!(sketchHistory.historyHolder.length > 5 + 1)) return null; //ignore [0]
    let losses = sketchHistory.historyHolder.slice(-5);
    console.log(losses.map((e) => e.loss));
    return losses.reduce((t, v) => t + v.loss, 0) / losses.length;
};

const incrementHistory = () => {
    controller.step += 1;
    timeKeeper.setAttribute("max", String(controller.step));
    timeKeeper.value = String(controller.step);
    sketchHistory.historyHolder.push({
        svg: mainSketch.svg,
        loss: mainSketch.semanticLoss,
    });
};

const getRGBA = (a) => {
    let rgba = controller.strokeColor.replace(/[^\d,]/g, "").split(",");
    rgba[3] = a;
    return `rgba(${rgba.join()})`;
};

const RGB_Linear_Blend = (p, c0, c1) => {
    var i = parseInt,
        r = Math.round,
        P = 1 - p,
        [a, b, c, d] = c0.split(","),
        [e, f, g, h] = c1.split(","),
        x = d || h,
        j = x ?
        "," +
        (!d ?
            h :
            !h ?
            d :
            r((parseFloat(d) * P + parseFloat(h) * p) * 1000) / 1000 + ")") :
        ")";
    return (
        "rgb" +
        (x ? "a(" : "(") +
        r(
            i(a[3] == "a" ? a.slice(5) : a.slice(4)) * P +
            i(e[3] == "a" ? e.slice(5) : e.slice(4)) * p
        ) +
        "," +
        r(i(b) * P + i(f) * p) +
        "," +
        r(i(c) * P + i(g) * p) +
        j
    );
};

const download = () => {
    // REMOVE REFs to select box
    // to do: refactor these.
    mainSketch.sketchLayer.getItems().forEach((path) => {
        path.selected = false;
    });
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });

    logger.event("save-sketch");

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

            let b = document.createElement("a");
            let text = mainSketch.svg;
            b.setAttribute(
                "href",
                "data:text/plain;charset=utf-8," + encodeURIComponent(text)
            );
            b.setAttribute("download", "sketch.txt");
            document.body.appendChild(b);
            b.click();
            document.body.removeChild(b);
        }
    });
};

const loadResponse = (result) => {
    console.log("Result: ", result);
    if (controller.clipDrawing) {
        if (result.status === "None") {
            loadUpdates(result);
        }
        // To Do: Tidy
        if (result.status.match(/\d+/g) != null) {
            if (result.svg === "") return null;
            let sketch = controller.sketches[parseInt(result.status)];
            sketch.load(
                sketchSize / 224,
                result.svg,
                result.fixed,
                sketch.sketchLayer
            );
        }
    }
};

const loadUpdates = (result) => {
    controller.lastIteration = result.iterations;
    mainSketch.load(scaleRatio, result.svg, result.fixed, true, true);
    mainSketch.semanticLoss = parseFloat(result.loss);
    incrementHistory();
};

const loadPartial = () => {
    const scaleTo = mainSketch.sketchLayer.view.viewSize.width;
    const idx = Math.floor(Math.random() * partialSketches.length);
    const partial = partialSketches[idx][0];
    const drawPrompt = partialSketches[idx][1];
    document.getElementById("partial-message").innerHTML = drawPrompt;
    let loadedPartial = mainSketch.sketchLayer.importSVG(partial);

    loadedPartial.getItems().forEach((item) => {
        if (item instanceof Path) {
            let newElem = mainSketch.sketchLayer.addChild(item.clone());
            newElem.data.fixed = true;
            newElem.strokeCap = "round";
            newElem.strokeJoin = "round";
        }
    });
    loadedPartial.remove();
    scaleGroup(mainSketch.sketchLayer, scaleTo);
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
};

const scaleRange = (number, inMin, inMax, outMin, outMax) => {
    return ((number - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};