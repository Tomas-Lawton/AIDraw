// Drawing Controls
document.querySelectorAll(".pen-mode").forEach((elem) => {
    elem.addEventListener("click", () => {
        setPenMode(elem.id, elem);
    });
});
document.querySelectorAll(".swatch").forEach((elem) => {
    elem.addEventListener("click", () => {
        let col = window.getComputedStyle(elem).backgroundColor;
        mainSketch.opacity = 1;
        opacitySlider.value = 100;

        mainSketch.strokeColor = col;
        picker.setColor(col);
        getRGBA();
    });
});

document.getElementById("delete").addEventListener("click", () =>
    openModal({
        title: "Clearing Canvas",
        message: "Are you sure you want to delete your drawing?",
        confirmAction: () => {
            // Save before clearing
            mainSketch.svg = paper.project.exportSVG({
                asString: true,
            });
            logger.event("clear-sketch");

            mainSketch.lastPrompt = null;
            userLayer.clear();
            modal.style.display = "none";
            updateSelectUI();

            // Save again for redraws
            mainSketch.svg = paper.project.exportSVG({
                asString: true,
            });
        },
    })
);

document.body.addEventListener("keydown", function(event) {
    if (document.activeElement !== prompt) {
        if (event.key == "Delete" || event.key == "Backspace") {
            deletePath();
        }
    }
});

deleteHandler.addEventListener("click", (e) => {
    deletePath();
});

initialiseHandler.addEventListener("click", (e) => {
    // need to unpack the group, but keep a ref to the selected/grouped paths
    // let selectedItems = getSelectedPaths();
    const remove = userLayer.getItems().filter((path) => !path.selected);
    remove.forEach((item) => item.remove());
    const svg = paper.project.exportSVG({
        asString: true,
    });
    console.log(svg);
    // userLayer.clear();
    mainSketch.draw(false, svg); //breaks with group

    // Special case
    // unpackGroup();
});

document.getElementById("begin").addEventListener("click", () => {
    document.getElementById("sliding-overlay").style.bottom = "100%";
});

document.getElementById("undo").addEventListener("click", () => {
    if (mainSketch.stack.undoStack.length > 0) {
        const lastEvent = mainSketch.stack.undoStack.pop();
        if (lastEvent.type === "draw-event") {
            let thisPath; //json from redo, otherwise path
            try {
                let temp = new Path();
                thisPath = temp.importJSON(lastEvent.data);
            } catch (e) {
                thisPath = lastEvent.data;
            }
            let copy = thisPath.exportJSON();
            mainSketch.stack.redoStack.push({
                type: "draw-event",
                data: copy,
            }); //so remove does not remove reference
            thisPath.remove();
        }
        if (lastEvent.type === "delete-event") {
            let pathData = [];
            lastEvent.data.map((redrawPath) => {
                let thisPath = new Path();
                thisPath = thisPath.importJSON(redrawPath);
                pathData.push(thisPath);
            });
            mainSketch.stack.redoStack.push({
                type: "delete-event",
                data: pathData, //use ref
            });
        }
        if (lastEvent.type === "erase-event") {
            let afterErase = userLayer.exportJSON();
            userLayer.clear();
            let lastItems = userLayer.importJSON(lastEvent.data);
            mainSketch.stack.redoStack.push({
                type: "erase-event",
                data: afterErase, //use ref
            });
        }

        mainSketch.svg = paper.project.exportSVG({
            asString: true,
        });
        logger.event("undo-" + lastEvent.type);
    }
});
document.getElementById("redo").addEventListener("click", () => {
    if (mainSketch.stack.redoStack.length > 0) {
        const lastEvent = mainSketch.stack.redoStack.pop();
        if (lastEvent.type === "draw-event") {
            let item = new Path();
            item.importJSON(lastEvent.data);
            mainSketch.stack.undoStack.push(lastEvent);
        }
        if (lastEvent.type === "delete-event") {
            let pathList = [];
            lastEvent.data.map((path) => {
                let pathCopy = path.exportJSON();
                path.remove();
                pathList.push(pathCopy);
            });
            mainSketch.stack.undoStack.push({
                type: "delete-event",
                data: pathList,
            }); // need to store a json to redraw
        }
        if (lastEvent.type === "erase-event") {
            let beforeErase = userLayer.exportJSON();
            userLayer.clear();
            let eraseItems = userLayer.importJSON(lastEvent.data);
            mainSketch.stack.undoStack.push({
                type: "erase-event",
                data: beforeErase, //use ref
            });
        }

        mainSketch.svg = paper.project.exportSVG({
            asString: true,
        });
        logger.event("redo-" + lastEvent.type);
    }
});
document.getElementById("save").addEventListener("click", () => {
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
    logger.event("save-sketch");

    canvas.toBlob((blob) => {
        let url = window.URL || window.webkitURL;
        let link = url.createObjectURL(blob);
        // window.open(link, "_blank");

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
});
document.getElementById("width-slider").oninput = function() {
    mainSketch.strokeWidth = this.value;
    const point = document.getElementById("point-size");
    point.style.width = mainSketch.strokeWidth + "px";
    point.style.height = mainSketch.strokeWidth + "px";
    getSelectedPaths().forEach(
        (item) => (item.strokeWidth = mainSketch.strokeWidth)
    );
    // setPenMode("pen", document.getElementById("pen"));
};

selectGroup = null;

rotateSlider.oninput = function() {
    hideSelectUI(false);
    let r = this.value;
    mainSketch.transformGroup.rotation = r;
    let items = getSelectedPaths();
    fitToSelection(items, "rotating");
    updateSelectUI();
};

rotateNumber.oninput = function() {
    hideSelectUI(false);
    let r = this.value;
    mainSketch.transformGroup.rotation = r;
    let items = getSelectedPaths();
    fitToSelection(items, "rotating");
    updateSelectUI();
};

scaleSlider.oninput = function() {
    // if (mainSketch.boundingBox.data.state === "rotating") {
    hideSelectUI(false);
    let selectedPaths = getSelectedPaths(); // all selected

    for (child of selectedPaths) {
        child.applyMatrix = false;
        child.scaling = this.value / 5;
    }
    fitToSelection(selectedPaths, "scaling");
    updateSelectUI();
};

scaleNumber.oninput = function() {
    hideSelectUI(false);
    let selectedPaths = getSelectedPaths(); // all selected

    for (child of selectedPaths) {
        child.applyMatrix = false;
        child.scaling = this.value / 5;
    }
    fitToSelection(selectedPaths, "scaling");
    updateSelectUI();
};

opacitySlider.oninput = function() {
    mainSketch.opacity = this.value / 100;
    console.log(mainSketch.opacity);
    getRGBA();
    getSelectedPaths().forEach((item) => (item.opacity = mainSketch.opacity));
};

document.getElementById("autonomy-slider").oninput = function() {
    let val = 11 - this.value;
    // 0-10
    mainSketch.randomRange = val; //used for adding
};

document.getElementById("enthusiasm-slider").oninput = function() {
    let val = 11 - this.value;
    if (val === 10) {
        //max time
        mainSketch.doneSketching = null; // never add
    } else {
        mainSketch.doneSketching = val * 1.3 * 1000 + 2000;
    }
};

document.getElementById("settings").addEventListener("click", () => {
    openModal({
        title: "Advanced",
        message: "Change the drawing behaviour and UI.",
        ui: document.getElementById("settings-ui"),
    });
});

timeKeeper.oninput = function() {
    if (this.value === 0) return; // 0 is pre-generation state
    historyIndex = this.value;
    userLayer.clear();
    if (mainSketch.numTraces > 1) {
        showTraceHistoryFrom(historyIndex);
    } else {
        userLayer.clear();
        let svg = mainSketch.stack.historyHolder[historyIndex].svg;
        parseFromSvg(svg, userLayer);
        mainSketch.svg = paper.project.exportSVG({
            asString: true,
        });
    }
};

palette.addEventListener("click", () => {
    toggleArtControls();
});

// let typingTimer;
// let doneTypingInterval = 1000;
prompt.addEventListener("input", (e) => {
    mainSketch.prompt = e.target.value;
    aiMessage.innerHTML = `Sure! I can draw ${mainSketch.prompt}...`;
    // clearTimeout(typingTimer);
    // typingTimer = setTimeout(doneTypingPrompt, doneTypingInterval);
});

// function doneTypingPrompt() {
//     aiMessage.innerHTML = `Sure! I can draw ${mainSketch.prompt}...`;
// }

// TODO Refactor into the setActionUI switch statement using states

// Draw
document.getElementById("draw").addEventListener("click", () => {
    if (mainSketch.drawState === "inactive" || mainSketch.drawState === "stop") {
        mainSketch.draw();
    }
});

// Refine
document.getElementById("refine").addEventListener("click", () => {
    if (mainSketch.drawState === "inactive" || mainSketch.drawState === "stop") {
        mainSketch.draw(false, null, true);
    }
});

// // Trial / Brainstorm

// Stop
stopButton.addEventListener("click", () => {
    if (mainSketch.activeStates.includes(mainSketch.drawState)) {
        //active
        mainSketch.stop();
    } else {
        mainSketch.redraw();
    }
});

// AI Revise

// // Continue
document.getElementById("go-back").addEventListener("click", () => {
    if (mainSketch.drawState === "stop") {
        mainSketch.goBack();
    }
});

// Redraw
document.getElementById("redraw").addEventListener("click", () => {
    if (mainSketch.drawState === "stop") {
        mainSketch.redraw();
    }
});
// // Contine
// actionControls[6].addEventListener("click", () => {
//     if (mainSketch.drawState === "stop") {
//         mainSketch.continue();
//     }
// });

// Old generate
// document.getElementById("brainstorm").addEventListener("click", () => {
//     if (mainSketch.drawState === "inactive" || mainSketch.drawState === "stop") {
//         mainSketch.generate();
//     }
// });

document.getElementById("brainstorm").addEventListener("click", () => {
    if (noPrompt()) {
        openModal({
            title: "Type a prompt first!",
            message: "You need a target for AI exemplars.",
        });
        return;
    } else {
        // Set up the ui
        let creationIndex = mainSketch.exemplarCount;
        let newElem = createExemplar(creationIndex);
        let thisCanvas = exemplarScope.projects[creationIndex];
        document.getElementById("exemplar-grid").appendChild(newElem);
        mainSketch.exemplarCount += 1;

        // // draw into the new canvas

        console.log(creationIndex);
        mainSketch.drawExemplar(creationIndex);

        // tell backend which exemplar it is, if it doesn't exist then create it.
        // then draw into this exemplar when the data is received.

        // if an AI exemplar is deleted -> this will remove it from backend drawers !!!!!! add to creating exemplar function !!!
    }
});

// Control panel
artControls.onmousedown = (e) => {
    if (window.innerWidth > 650) {
        let content;
        document.querySelectorAll(".tab-item").forEach((tab) => {
            if (tab.classList.contains("active-tab")) {
                if (tab.id === "collab-tab") {
                    content = document.getElementById("ai-content");
                } else {
                    content = document.getElementById("style-content");
                }
            }
        });
        // content = document.getElementById("style-content");

        let bounds = content.getBoundingClientRect();
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;
        if (
            pos3 < bounds.left ||
            pos3 > bounds.right ||
            pos4 < bounds.top ||
            pos4 > bounds.bottom
        ) {
            document.onmouseup = closeDragElement;
            document.onmousemove = (e) => elementDrag(e, artControls);
        }
    }
};

document.getElementById("sketchbook-panel").onmousedown = (e) => {
    if (window.innerWidth > 650) {
        let content = document.getElementById("sketchbook-content");
        let bounds = content.getBoundingClientRect();
        e = e || window.event;
        pos3 = e.clientX;
        pos4 = e.clientY;
        if (
            pos3 < bounds.left ||
            pos3 > bounds.right ||
            pos4 < bounds.top ||
            pos4 > bounds.bottom
        ) {
            document.onmouseup = closeDragElement;
            document.onmousemove = (e) =>
                elementDrag(e, document.getElementById("sketchbook-panel"));
        }
    }
};

function elementDrag(e, item) {
    e = e || window.event;
    // e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    item.style.top = item.offsetTop - pos2 + "px";
    item.style.left = item.offsetLeft - pos1 + "px";
}

function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
}

document.querySelectorAll(".tab-item").forEach((tab) => {
    tab.addEventListener("click", () => {
        if (!tab.classList.contains("active-tab")) {
            document
                .querySelectorAll(".tab-item")
                .forEach((tabItem) => tabItem.classList.toggle("active-tab"));

            if (tab.id == "style-tab") {
                document.getElementById("style-content").parentElement.style.display =
                    "block";
                document.getElementById("ai-content").parentElement.style.display =
                    "none";
            } else {
                document.getElementById("style-content").parentElement.style.display =
                    "none";
                document.getElementById("ai-content").parentElement.style.display =
                    "block";
            }
        }
    });
});

// document.querySelectorAll(".card-icon-background").forEach((elem) => {
//     elem.addEventListener("click", () => {
//         console.log("test");
//         elem.parentElement.parentElement.remove();
//     });
// });

document.getElementById("save-sketch").addEventListener("click", () => {
    let jsonGroup = exportToExemplar();
    let creationIndex = mainSketch.exemplarCount;
    let newElem = createExemplar(creationIndex);
    let thisCanvas = exemplarScope.projects[creationIndex];
    let imported = thisCanvas.activeLayer.importJSON(jsonGroup);
    imported.position = new Point(exemplarSize / 2, exemplarSize / 2);
    document.getElementById("exemplar-grid").appendChild(newElem);
    mainSketch.exemplarCount += 1;
});

// document.getElementById("use-squiggles").addEventListener("change", (event) => {
//     mainSketch.initRandomCurves = !mainSketch.initRandomCurves;
//     let container = document.getElementById("contain-num-squiggles");
//     if (container.style.display === "none") {
//         container.style.display = "contents";
//     } else {
//         container.style.display = "none";
//     }
// });

// document.getElementById("num-squiggles").oninput = function() {
//     mainSketch.numRandomCurves = parseInt(this.value);
// };

document.getElementById("num-traces").oninput = function() {
    mainSketch.numTraces = parseInt(this.value);
};

// document.getElementById("set-background").onclick = function() {
//     canvas.style.backgroundColor = mainSketch.strokeColor;
// };

// document.getElementById("moodboard-cross").addEventListener("click", () => {
//     if (!moodboard.style.display || moodboard.style.display === "none") {
//         moodboard.style.display = "block";
//     } else {
//         moodboard.style.display = "none";
//     }
// });

// LOAD UI

// Random partial sketch
// const partial = userLayer.importSVG(sketches[Math.floor(Math.random() * 3)]);
// partial.scale(1000);
// // TO DO: Scale to canvas size
// partial.set({
//     position: new Point(540, 540),
//     strokeWidth: mainSketch.strokeWidth,
//     opacity: mainSketch.opacity,
//     strokeCap: "round",
//     strokeJoin: "round",
// });
// partial.getItems().forEach((path) => userLayer.addChild(path));
// partial.remove();

const picker = new Picker({
    parent: document.getElementById("color-picker"),
    popup: false,
    alpha: false,
    defaultColor: "#0cf",
    editor: false,
    editorFormat: "hex", // or 'rgb', 'hsl'
});

picker.setColor(mainSketch.strokeColor);
picker.onChange = (color) => {
    mainSketch.strokeColor = color.rgbaString;
    getRGBA();
    getSelectedPaths().forEach(
        (item) => (item.strokeColor = mainSketch.strokeColor)
    );
    // setPenMode("pen", document.getElementById("pen"));
};

// AI STUFF

// document.getElementById("open-moodboard").addEventListener("click", () => {
//     // document.getElementById("moodboard-container").style.display = "flex";
//     document.getElementById("sketchbook-panel").style.display = "flex";
// });

setActionUI("inactive");