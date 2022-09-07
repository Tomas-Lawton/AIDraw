// To do clean this up
let sketchTimer,
    penPath,
    erasePath,
    regionPath,
    tmpGroup,
    mask,
    selectBox,
    firstPoint,
    firstErasePoint,
    lastFrameParent;

sketchTool.onMouseDown = function(event) {
    console.log(mainSketch.sketchLayer.children);

    clearTimeout(sketchTimer);

    let hitResult = mainSketch.sketchLayer.hitTest(event.point);

    switch (controller.penMode) {
        case "select":
            path = null;

            if (isDeselect(event, hitResult)) {
                ungroup();
                mainSketch.sketchLayer.getItems().forEach((path) => {
                    path.selected = false;
                });

                if (controller.transformGroup !== null) {
                    controller.transformGroup.remove();
                    controller.transformGroup = null;
                }

                // Update
                mainSketch.svg = paper.project.exportSVG({
                    asString: true,
                });
                setLineLabels(mainSketch.sketchLayer);
                if (controller.liveCollab) {
                    controller.continueSketch();
                    controller.liveCollab = false;
                }
                controller.selectBox = new Rectangle(event.point);
            }

            if (hitResult) {
                sketchHistory.pushUndo();

                pauseActiveDrawer();
                ungroup();

                path = hitResult.item;
                path.selected = true;
                let items = getSelectedPaths();
                createGroup(items);
                fitToSelection(items, "moving");
                updateSelectUI();
            }
            break;
        case "pen":
            sketchHistory.pushUndo();

            pauseActiveDrawer();

            penPath = new Path({
                strokeColor: controller.strokeColor,
                strokeWidth: controller.strokeWidth,
                strokeCap: "round",
                strokeJoin: "round",
            });
            firstPoint = penPath.add(event.point);
            penPath.add({
                ...event.point,
                x: event.point.x + 0.05, //any smaller will break because BE changes to v0
            });
            break;
        case "local":
            // if you pen down on a segment, then you can resize the box
            controller.drawRegion = new Rectangle(event.point);

            let frameCol =
                frameColors[Math.floor(Math.random() * frameColors.length)];
            lastFrameParent = document.createElement("div");
            lastFrameParent.classList.add("frame-parent");
            let frameInput = document.createElement("input");
            let frameCross = document.createElement("i");
            let dragIcon = document.createElement("div");

            frameCross.classList.add("fa-solid", "fa-xmark");
            frameInput.style.background = frameCol;
            frameCross.style.background = frameCol;
            lastFrameParent.appendChild(frameInput);
            lastFrameParent.appendChild(frameCross);
            lastFrameParent.appendChild(dragIcon);
            sketchContainer.appendChild(lastFrameParent);

            lastFrameParent.style.top =
                controller.drawRegion.top - lastFrameParent.clientHeight + "px";
            lastFrameParent.style.left = controller.drawRegion.left + "px";
            lastFrameParent.width = controller.drawRegion.width + "px";

            dragIcon.style.top =
                controller.drawRegion.height + lastFrameParent.clientHeight + "px";
            dragIcon.style.left = controller.drawRegion.width + "px";
            break;
        case "erase":
            sketchHistory.pushUndo();

            pauseActiveDrawer();

            erasorPath = new Path({
                strokeWidth: controller.strokeWidth,
                strokeCap: "round",
                strokeJoin: "round",
                opacity: 0.85,
                strokeColor: "rgb(255,0, 0)",
            });
            firstErasePoint = erasorPath.add(event.point);
            erasorPath.add({
                ...event.point,
                x: event.point.x + 0.05, //any smaller will break because BE changes to v0
            });
            tmpGroup = new Group({
                children: mainSketch.sketchLayer.removeChildren(),
                blendMode: "source-out",
                insert: false,
            });
            mask = new Group({
                children: [erasorPath, tmpGroup],
                blendMode: "source-over",
            });
            break;
        case "dropper":
            let col = hitResult ? hitResult.item.strokeColor._canvasStyle : "#ffffff";
            controller.strokeColor = col;
            controller.alpha = controller.strokeColor.alpha || 1;
            console.log(controller.alpha);
            setThisColor(controller.strokeColor);
            picker.setColor(controller.strokeColor, true);
            console.log(controller.strokeColor);

            alphaSlider.value =
                parseFloat(controller.strokeColor.split(",")[3] || 1) * 100;
            hitResult && setPointSize(hitResult.item.strokeWidth);
    }
};

sketchTool.onMouseDrag = function(event) {
    switch (controller.penMode) {
        case "pen":
            penPath.add(event.point);
            // penPath.smooth();
            break;
        case "erase":
            erasorPath.add(event.point);
            break;
        case "select":
            if (controller.boundingBox) {
                if (controller.boundingBox.data.state === "moving") {
                    controller.transformGroup.position.x += event.delta.x;
                    controller.transformGroup.position.y += event.delta.y;
                    controller.boundingBox.position.x += event.delta.x;
                    controller.boundingBox.position.y += event.delta.y;

                    // controller.transformGroup.children.forEach((path) => {
                    //     path.data.fixed = true;
                    // });
                    updateSelectUI();
                }
            } else if (controller.selectBox !== undefined) {
                //creating box
                pauseActiveDrawer();
                controller.selectBox.width += event.delta.x;
                controller.selectBox.height += event.delta.y;
                if (selectBox) {
                    selectBox.remove();
                } // redraw //REFACTOR
                selectBox = new Path.Rectangle(controller.selectBox);
                selectBox.set(rectangleOptions);
            }
            break;
        case "local":
            controller.drawRegion.width += event.delta.x;
            controller.drawRegion.height += event.delta.y;
            if (regionPath !== undefined) regionPath.remove(); //remove old one. maybe could update the old one instead?
            regionPath = new Path.Rectangle(controller.drawRegion);
            regionPath.set(frameOptions);

            lastFrameParent.style.width = controller.drawRegion.width + "px";

            let dragIcon = lastFrameParent.querySelector("div");
            dragIcon.style.top =
                controller.drawRegion.height + lastFrameParent.clientHeight + "px";
            dragIcon.style.left = controller.drawRegion.width + "px";
            break;
    }
};

sketchTool.onMouseUp = function() {
    // so the latest sketch is available to the drawer
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });

    switch (controller.penMode) {
        case "select":
            if (selectBox) {
                //after moving
                //moving selection
                let items = mainSketch.sketchLayer.getItems({
                    inside: selectBox.bounds,
                });
                let rect = items.pop();
                if (rect) {
                    rect.remove(); // can be undefined if flat box
                }
                items.forEach((item) => (item.selected = true));
                if (controller.selectBox) {
                    controller.selectBox = null;
                    selectBox.remove();
                    selectBox = null;
                }
                let path = fitToSelection(items, "moving"); //try update
                // IS THIS STILL NEEDED?
                if (!getSelectedPaths().length) {
                    path.remove();
                }
                createGroup(items); //transformGroup
                // fit to selction?
                updateSelectUI();
            }
            if (controller.boundingBox) {
                //after creating selection by dragging
                if (!getSelectedPaths().length) {
                    ungroup();
                } else {
                    controller.boundingBox.data.state = "moving";
                }
            }
            break;
        case "pen":
            if (firstPoint && penPath.segments.length > 2) {
                firstPoint.remove();
            }
            penPath.simplify();
            console.log(penPath);

            penPath.data.fixed = true;
            // Update
            mainSketch.svg = paper.project.exportSVG({
                asString: true,
            });
            setLineLabels(mainSketch.sketchLayer);
            if (socket) {
                if (controller.liveCollab) {
                    controller.continueSketch();
                    controller.liveCollab = false;
                } else if (!noPrompt() && controller.doneSketching !== null) {
                    //stopped with collab draw
                    {
                        clearTimeout(sketchTimer);
                        sketchTimer = setTimeout(() => {
                            controller.draw();
                            let time = (Math.floor(Math.random() * 5) + 5) * 1000;
                            setTimeout(() => {
                                console.log("drawing for: ", time);
                                controller.stop();
                                controller.clipDrawing = false;
                            }, time);
                        }, controller.doneSketching);
                    }
                }
            }

            break;
        case "local":
            regionPath.remove();

            let newFrame = new Path.Rectangle(controller.drawRegion);
            newFrame.set(frameOptions); //completed

            let frameUI = lastFrameParent;
            let input = frameUI.querySelector("input");
            let closeFrame = frameUI.querySelector("i");
            let dragCorner = frameUI.querySelector("div");

            let tag = document.createElement("li");
            let localPrompt = document.createElement("p");
            let circle = document.createElement("div");
            circle.style.background = frameUI.querySelector("input").style.background;
            tag.appendChild(circle);
            tag.appendChild(localPrompt);
            localPrompts.querySelector("ul").appendChild(tag);

            let i = mainSketch.localFrames.length;

            frameUI.addEventListener("input", (e) => {
                localPrompt.innerHTML = e.target.value;
                mainSketch.localFrames[i].data.prompt = e.target.value;
            });

            tag.addEventListener("click", (e) => {
                input.focus();
                mainSketch.localFrames.forEach((elem) => {
                    elem.tag.style.background = "transparent";
                    elem.frame.style.opacity = 1;
                });

                frameUI.style.opacity = 0.7;
                tag.style.background = "#413d60";
            });

            closeFrame.addEventListener("click", (e) => {
                mainSketch.localFrames.splice(i, 1);
                tag.remove();
                frameUI.remove();
                newFrame.remove();
            });

            input.onmousedown = (e) => {
                if (window.innerWidth > 700) {
                    e = e || window.event;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    document.onmouseup = closeDragElement;
                    document.onmousemove = (e) => {
                        elementDrag(e, frameUI);
                        newFrame.position.x += e.movementX;
                        newFrame.position.y += e.movementY;

                        mainSketch.localFrames[i].data.points = {
                            x1: topLeft.x,
                            y1: topLeft.y,
                            x2: bottomRight.x,
                            y2: bottomRight.y,
                        };
                    };
                }
            };

            dragCorner.onmousedown = (e) => {
                if (window.innerWidth > 700) {
                    e = e || window.event;
                    pos3 = e.clientX;
                    pos4 = e.clientY;
                    document.onmouseup = closeDragElement;
                    document.onmousemove = (e) => {
                        // update other rects to do this instead
                        newFrame.bounds.width += e.movementX;
                        newFrame.bounds.height += e.movementY;
                        frameUI.style.width = newFrame.bounds.width + "px";
                        dragCorner.style.top =
                            newFrame.bounds.height + frameUI.clientHeight + "px";
                        dragCorner.style.left = newFrame.bounds.width + "px";

                        let topLeft = newFrame.bounds.topLeft;
                        let bottomRight = newFrame.bounds.bottomRight;

                        mainSketch.localFrames[i].data.points = {
                            x1: topLeft.x,
                            y1: topLeft.y,
                            x2: bottomRight.x,
                            y2: bottomRight.y,
                        };
                        frameUI.querySelector("input").focus();
                    };
                }
            };

            let topLeft = newFrame.bounds.topLeft;
            let bottomRight = newFrame.bounds.bottomRight;

            mainSketch.localFrames.push({
                tag: tag,
                frame: frameUI,
                paperFrame: newFrame,
                data: {
                    prompt: "default",
                    points: {
                        x1: topLeft.x,
                        y1: topLeft.y,
                        x2: bottomRight.x,
                        y2: bottomRight.y,
                    },
                },
            });
            frameUI.querySelector("input").focus();
            break;
        case "erase":
            if (firstErasePoint && erasorPath.segments.length > 2) {
                firstErasePoint.remove();
            }
            erasorPath.simplify();
            const eraseRadius = controller.strokeWidth;
            const outerPath = OffsetUtils.offsetPath(erasorPath, eraseRadius);
            const innerPath = OffsetUtils.offsetPath(erasorPath, -eraseRadius);
            erasorPath.remove();
            outerPath.insert = false;
            innerPath.insert = false;
            innerPath.reverse();
            let deleteShape = new Path({
                closed: true,
                insert: false,
            });
            deleteShape.addSegments(outerPath.segments);
            deleteShape.addSegments(innerPath.segments);
            const endCaps = new CompoundPath({
                children: [
                    new Path.Circle({
                        center: erasorPath.firstSegment.point,
                        radius: eraseRadius,
                    }),
                    new Path.Circle({
                        center: erasorPath.lastSegment.point,
                        radius: eraseRadius,
                    }),
                ],
                insert: false,
            });
            deleteShape = deleteShape.unite(endCaps);
            deleteShape.simplify();

            const erasorItems = tmpGroup.getItems({
                overlapping: deleteShape.bounds,
            });
            erasorItems.forEach(function(erasorItem) {
                const result = erasorItem.subtract(deleteShape, {
                    trace: false,
                    insert: false,
                });
                if (result.children) {
                    //split path
                    let splitPaths = result.removeChildren();
                    erasorItem.parent.insertChildren(erasorItem.index, splitPaths);

                    // splitPaths.forEach((newPath) => {
                    //     newPath.data.fixed = true;
                    // });

                    erasorItem.remove();
                    result.remove(); //remove the compound paths
                } else {
                    // don't split
                    if (!result.segments.length) {
                        console.log("Removed");
                        erasorItem.remove();
                        result.remove();
                    } else {
                        erasorItem.replaceWith(result); //replace
                        // result.data.fixed = true;
                    }
                }
            });

            mainSketch.sketchLayer.addChildren(tmpGroup.removeChildren());
            mask.remove();

            // Update
            mainSketch.svg = paper.project.exportSVG({
                asString: true,
            });
            setLineLabels(mainSketch.sketchLayer);
            if (controller.liveCollab) {
                controller.continueSketch();
                controller.liveCollab = false;
            }
            break;
    }

    // Save
    mainSketch.svg = paper.project.exportSVG({
        asString: true,
    });
    setLineLabels(mainSketch.sketchLayer);
    // logger.event(controller.penMode + "-up");

    console.log(mainSketch.sketchLayer);
};

const setPenMode = (mode, accentTarget) => {
    document.querySelectorAll(".pen-mode").forEach((mode) => {
        mode.classList.remove("selected-mode");
        mode.classList.add("simple-hover");
    });

    switch (mode) {
        // case "pen-drop":
        //     if (useAI) {
        //         if (dropdown.style.display !== "flex") {
        //             dropdown.style.display = "flex";
        //             dropdown.style.top =
        //                 buttonPanel.getBoundingClientRect().bottom + "px";
        //             dropdown.style.left =
        //                 penDrop.getBoundingClientRect().left +
        //                 penDrop.getBoundingClientRect().width / 2 +
        //                 "px";
        //             setPenMode(controller.penDropMode, penDrop);
        //         } else {
        //             dropdown.style.display = "none";
        //         }
        //     } else {
        //         setPenMode("select", penDrop);
        //     }

        //     break;
        case "erase":
            if (accentTarget) {
                accentTarget.classList.add("selected-mode");
                accentTarget.classList.remove("simple-hover");
            }
            canvas.style.cursor = "url('public/erase.svg') 8 11, move";
            // if (useAI) {
            //     dropdown.style.display = "none";
            // }
            controller.penMode = mode;
            break;
        case "pen":
            if (accentTarget) {
                accentTarget.classList.add("selected-mode");
                accentTarget.classList.remove("simple-hover");
            }
            canvas.style.cursor = "url('public/pen.svg') -1 20, move";

            let swatches = document.getElementById("swatches");

            if (window.innerWidth < 700) {
                if (swatches.style.display !== "flex") {
                    swatches.style.display = "flex";
                    swatches.style.top =
                        document.getElementById("pen-controls").getBoundingClientRect()
                        .bottom +
                        5 +
                        "px";
                } else {
                    swatches.style.display = "none";
                }
            }
            // dropdown.style.display = "none";
            controller.penMode = mode;
            "pen";
            break;
        case "select":
            if (accentTarget) {
                accentTarget.classList.add("selected-mode");
                accentTarget.classList.remove("simple-hover");
            }
            canvas.style.cursor = "url('public/select.svg') 3 2, move";
            // penDrop.classList.add("selected-mode");
            // penDrop.classList.remove("fa-eraser");
            // penDrop.classList.remove("fa-object-group");
            // penDrop.classList.add("fa-arrow-pointer");
            controller.penMode = mode;
            // controller.penDropMode = mode;
            break;
        case "local":
            canvas.style.cursor = "crosshair";
            controller.penMode = mode;
            break;
        case "dropper":
            if (accentTarget) {
                accentTarget.classList.add("selected-mode");
                accentTarget.classList.remove("simple-hover");
            }
            canvas.style.cursor = "url('public/dropper.svg') -1 20, move";

            controller.penMode = mode;
            document.getElementById("dropper").style.color = "#ffffff";
    }

    if (controller.penMode !== "select") {
        ungroup();
        mainSketch.sketchLayer.getItems().forEach((path) => {
            path.selected = false;
        });
    }
    if (controller.penMode !== "local" && controller.penMode !== "select") {
        controller.drawRegion = undefined;
        if (regionPath) regionPath.remove();
        // penDrop.classList.remove("selected-mode");
    }

    if (controller.penMode !== "local") {
        mainSketch.sketchLayer.activate();
    }

    if (controller.penMode !== "dropper") {
        document.getElementById("dropper").style.color = "#363636";
    }
    // if (controller.penMode !== "dropper") {
    // document.getElementById("dropper").style.color = "#363636";
    // REMOVE LISTENR
    // }
};