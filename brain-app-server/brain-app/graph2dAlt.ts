﻿

declare var cytoscape;

class Graph2DAlt {
    id: number;
    jDiv;
    dataSet: DataSet;

    container;

    // UI
    graph2DAltDotClass: string;
    graph2DAltClass: string;

    // Options menu
    edgeLengthScale: number = 3;
    edgeBaseLength: number = 7;
    groupNodesBy = "none";
    colorMode: string;
    directionMode: string;
    mouseDownEventListenerAdded;
    layout = "cose";

    // Data
    commonData;
    config;
    saveObj;
    //edgeMatrix;

    nodes: any[];
    links: any[];

    //elements: any[];

    cy;

    constructor(id: number, jDiv, dataSet: DataSet, container, commonData, saveObj) {
        this.nodes = [];
        this.links = [];

        //this.elements = [];

        this.container = container;
        this.id = id;
        this.jDiv = jDiv;
        this.dataSet = dataSet;
        this.saveObj = saveObj;
        
        this.commonData = commonData;
        //this.edgeMatrix = edgeMatrix;
    }


    initGraph(colaGraph: Graph3D, camera) {
        // Use this.dataSet to build the elements for the cytoscape graph.
        // Include default values that are input to style fuctions.
        
        var width = this.jDiv.width();
        var height = this.jDiv.height();

        var unitRadius = 5;

        this.nodes.splice(0, this.nodes.length);
        this.links.splice(0, this.links.length);

        var children = colaGraph.nodeMeshes;
        this.colorMode = colaGraph.colorMode;
        this.directionMode = colaGraph.edgeDirectionMode;
                
        for (var i = 0; i < children.length; i++) {
            var node = children[i];
            var d = node.userData;

            var nodeObject = new Object();
            nodeObject["id"] = d.id;
            nodeObject["color"] = "#".concat(node.material.color.getHexString());
            nodeObject["radius"] = node.scale.x * unitRadius;
            nodeObject["colors"] = d.colors;

            // Use projection of colaGraph to screen space to initialise positions
            var position = (new THREE.Vector3()).setFromMatrixPosition(node.matrixWorld);
            position.project(camera);
            nodeObject["x"] = position.x;
            nodeObject["y"] = position.y;

            // for every attributes
            for (var j = 0; j < this.dataSet.attributes.columnNames.length; j++) {

                var colname = this.dataSet.attributes.columnNames[j];
                var value = this.dataSet.attributes.get(colname)[d.id];
                nodeObject[colname] = value;

                // add a special property for module id
                if (colname == 'module_id') {
                    nodeObject['moduleID'] = this.dataSet.attributes.get(colname)[d.id];
                }

                //  Get domain of the attributes (assume all positive numbers in the array)
                var columnIndex = this.dataSet.attributes.columnNames.indexOf(colname);
                var min = this.dataSet.attributes.getMin(columnIndex);
                var max = this.dataSet.attributes.getMax(columnIndex);

                // Scale value to between 0.05 to 1 
                var attrMap = d3.scale.linear().domain([min, max]).range([0.05, 1]);
                var scalevalue = attrMap(Math.max.apply(Math, value));
                nodeObject['scale_' + colname] = scalevalue;

                if (this.dataSet.attributes.info[colname].isDiscrete) { // if the attribute is discrete
                    // Scale to group attirbutes 
                    var values = this.dataSet.attributes.info[colname].distinctValues;
                    nodeObject['bundle_group_' + colname] = values.indexOf(value.indexOf(Math.max.apply(Math, value)));

                } else { // if the attribute is continuous
                    // Scale to group attirbutes 
                    var bundleGroupMap = d3.scale.linear().domain([min, max]).range([0, 9.99]); // use 9.99 instead of 10 to avoid a group of a single element (that has the max attribute value)
                    var bundleGroup = bundleGroupMap(Math.max.apply(Math, value)); // group
                    bundleGroup = Math.floor(bundleGroup);
                    nodeObject['bundle_group_' + colname] = bundleGroup;
                }
            }

            this.nodes.push(nodeObject);
        }

        // Add Edges to graph
        for (var i = 0; i < colaGraph.edgeList.length; i++) {
            var edge = colaGraph.edgeList[i];
            if (edge.visible) {
                var linkObject = new Object();
                linkObject["colaGraphEdgeListIndex"] = i;
                linkObject["color"] = edge.color;
                linkObject["width"] = edge.shape.scale.x;

                for (var j = 0; j < this.nodes.length; j++) {
                    if (this.nodes[j].id == edge.sourceNode.userData.id) {
                        linkObject["source"] = this.nodes[j];
                        linkObject["x1"] = this.nodes[j].x;
                        linkObject["y1"] = this.nodes[j].y;
                    }

                    if (this.nodes[j].id == edge.targetNode.userData.id) {
                        linkObject["target"] = this.nodes[j];
                        linkObject["x2"] = this.nodes[j].x;
                        linkObject["y2"] = this.nodes[j].y;
                    }
                }

                this.links.push(linkObject);
            }
        }

        this.updateGraph();
    }


    updateGraph() {
        // Use saveObj and this.layout to create the layout and style options, then create the cytoscape graph

        var container = this.container;
        var offsetLeft = container.offsetWidth * 0.5;
        var offsetTop = container.offsetHeight * 0.1;
        
        var nodes = this.nodes.map(d => ({
            data: {
                id: "n_" + d.id,
                sourceId: d.id,
                color: d.color,         //TODO: Can retire this when multiple colors is working across all visualisations
                colors: d.colors,
                radius: d.radius * 10
            },
            position: {
                x: d.x,
                y: d.y
            }
        }));
        var edges = this.links.map(d => ({
            data: {
                id: "e_" + d.colaGraphEdgeListIndex,
                source: "n_" + d.source.id,
                target: "n_" + d.target.id,
                color: d.source.color,
                highlight: false
            }
        }));
        var elements = nodes.concat(<any>edges);

        // Default layout is simple and fast
        var layout = <any>{
            name: "cose",
            animate: false
        }
        switch (this.layout) {
            case "cola":
                layout = <any>{
                    name: "cola",
                    animate: false,

                    // Options that may affect speed of layout
                    ungrabifyWhileSimulating: true,
                    maxSimulationTime: 1000,        // Only starts counting after the layout startup, which can take some time by itself. 0 actually works well.
                    //refresh: 5,                     // Probably on works when animating

                    //fit: true,
                    //boundingBox: { x1: offsetLeft, y1: offsetTop, w: width, h: height },      //TODO: seems to be doing nothing, would be nice
                    //padding: 50,

                    edgeLength: this.edgeBaseLength * this.edgeLengthScale,
                    //edgeSymDiffLength: 60
                    handleDisconnected: true,
                    avoidOverlap: true,

                    unconstrIter: 15,
                    userConstIter: 0,
                    allConstIter: 15,

                    flow: false
                }
                break;
            case "cola-flow":
                // Mostly the same as cola
                layout = <any>{
                    name: "cola",
                    animate: false,
                    ungrabifyWhileSimulating: true,
                    maxSimulationTime: 1000,
                    edgeLength: this.edgeBaseLength * this.edgeLengthScale,
                    handleDisconnected: true,
                    avoidOverlap: true,
                    unconstrIter: 15,
                    userConstIter: 0,
                    allConstIter: 15,

                    flow: true
                }
                break;
        }
        
        var nodeStyle = {
            "width": "data(radius)",
            "height": "data(radius)",
            "background-opacity": 0,
            "border-width": 3,
            "border-color": "black",
            "border-opacity": 0,
            "pie-size": "100%"      // Oversized to deal with aliasing from background
        };
        let colorAttribute = this.saveObj.nodeSettings.nodeColorAttribute;
        let nSlices = this.dataSet.attributes.info[colorAttribute].numElements;
        for (let i = 0; i < nSlices; i++) {
            nodeStyle[`pie-${i + 1}-background-color`] = e => e.data("colors")[i].color;
            nodeStyle[`pie-${i + 1}-background-size`] = e => e.data("colors")[i].portion * 100;
        }
        var edgeStyle = {
            'width': 3,
            'line-color': 'data(color)',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle'
        };

        this.cy = cytoscape({
            container,
            elements,
            style: [ // the stylesheet for the graph
                {
                    selector: "node",
                    style: nodeStyle 
                },
                {
                    selector: "edge",
                    style: edgeStyle
                },
                {
                    selector: "node.highlight",
                    style: {
                        'label': 'data(sourceId)',     //TODO: use configured attribute
                        "border-opacity": 0.5
                    }
                },
                {
                    selector: "node.select",
                    style: {
                        'label': 'data(sourceId)',     //TODO: use configured attribute
                        "border-opacity": 1.0
                    }
                }
            ],
            minZoom: 0.1,
            maxZoom: 10,
            layout
        });

        let commonData = this.commonData;
        let cy = this.cy;
        cy.pan({ x: offsetLeft, y: offsetTop });
        cy.zoom(this.cy.zoom() * 0.8);
        cy.on("mouseover", "node", function (e) {
            this.addClass("highlight");
            commonData.nodeIDUnderPointer[4] = this.data("sourceId");
        });
        cy.on("mouseout", "node", function (e) {
            this.removeClass("highlight");
            commonData.nodeIDUnderPointer[4] = -1;
        });
        cy.on("tap", "node", function (e) {
            cy.elements("node").removeClass("select");
            this.addClass("select");
            commonData.selectedNode = this.data("sourceId");
        });
    }
    
    setUserControl(isOn: boolean) {
        if (this.cy) {
            this.cy.userPanningEnabled(isOn);
            this.cy.userZoomingEnabled(isOn);
            this.cy.boxSelectionEnabled(isOn);
        }
    }


    /*
        Menu
    */

    settingOnChange() {
        var lengthScale = this.edgeLengthScale
        var baseLength = this.edgeBaseLength;
        var groupBy = this.groupNodesBy;

        var width = this.jDiv.width();
        var height = this.jDiv.height() - sliderSpace;
        var widthHalf = width / 2;
        var heightHalf = height / 2;
        var screenCoords = new THREE.Vector3();
        var unitRadius = 5;

        var edgeColorMode = this.colorMode;
        var edgeDirectionMode = this.directionMode;
        
        this.updateGraph();
    }

    menuButtonOnClick() {
        var l = $('#button-graph2dalt-option-menu-' + this.id).position().left + 5;
        var t = $('#button-graph2dalt-option-menu-' + this.id).position().top - $('#div-graph2dalt-layout-menu-' + this.id).height() - 15;


        $('#div-graph2dalt-layout-menu-' + this.id).zIndex(1000);
        $('#div-graph2dalt-layout-menu-' + this.id).css({ left: l, top: t, height: 'auto' });
        $('#div-graph2dalt-layout-menu-' + this.id).fadeToggle('fast');
    }

    setupOptionMenuUI() {
        // Remove existing html elements
        this.graph2DAltDotClass = ".graph-2dalt-menu-" + this.id;
        this.graph2DAltClass = "graph-2dalt-menu-" + this.id;
        $("label").remove(this.graph2DAltDotClass);
        $("select").remove(this.graph2DAltDotClass);
        $("button").remove(this.graph2DAltDotClass);
        $("div").remove(this.graph2DAltDotClass);

        // Function variables response to changes in settings
        var varEdgeLengthOnChange = () => {
            var edgeLengthScale = $("#div-edge-length-slider-alt-" + this.id)['bootstrapSlider']().data('bootstrapSlider').getValue();
            this.edgeLengthScale = edgeLengthScale;
            this.settingOnChange();
        };

        var varGroupNodesOnChange = (groupBy) => {
            this.groupNodesBy = groupBy;
            this.settingOnChange();
        }

        var varMenuButtonOnClick = () => { this.menuButtonOnClick(); };

        var changeLayout = layout => {
            this.layout = layout;
            this.updateGraph();
        }

        // Setting Options
        // option button
        this.jDiv.append($('<button id="button-graph2dalt-option-menu-' + this.id + '" class="' + this.graph2DAltClass + ' btn  btn-sm btn-primary" ' +
            'data-toggle="tooltip" data-placement="top" title="Show side-by-side graph representation">Options</button>')
            .css({ 'position': 'relative', 'margin-left': '5px', 'font-size': '12px', 'z-index': 1000 })
            .click(function () { varMenuButtonOnClick(); }));


        //------------------------------------------------------------------------
        // menu
        this.jDiv.append($('<div id="div-graph2dalt-layout-menu-' + this.id + '" class="' + this.graph2DAltClass + '"></div>')
            .css({
                'display': 'none',
                'background-color': '#feeebd',
                'position': 'absolute',
                'padding': '8px',
                'border-radius': '5px'
            }));

        //------------------------------------------------------------------------
        // menu - edge length
        $('#div-graph2dalt-layout-menu-' + this.id).append('<div>Edge Length<div/>');
        $('#div-graph2dalt-layout-menu-' + this.id).append($('<input id="div-edge-length-slider-alt-' + this.id + '" class=' + this.graph2DAltClass + 'data-slider-id="surface-opacity-slider" type="text"' +
            'data-slider-min="3" data-slider-max="10" data-slider-step="0.5" data-slider-value="1" />')
            .css({ 'position': 'relative', 'width': '150px' }));

        $("#div-edge-length-slider-alt-" + this.id)['bootstrapSlider']();
        $("#div-edge-length-slider-alt-" + this.id)['bootstrapSlider']().on('change', varEdgeLengthOnChange);
        

        // menu - group nodes
        $('#div-graph2dalt-layout-menu-' + this.id).append('<div id="div-graph2dalt-group-' + this.id + '">bundle: </div>');
        $('#div-graph2dalt-group-' + this.id).append($('<select id="select-graph2dalt-group-' + this.id + '" class=' + this.graph2DAltClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { varGroupNodesOnChange($(this).val()); }));

        $('#select-graph2dalt-group-' + this.id).empty();

        var option = document.createElement('option');
        option.text = 'none';
        option.value = 'none';
        $('#select-graph2dalt-group-' + this.id).append(option);

        // Add descrete attribute to list
        for (var i = 0; i < this.dataSet.attributes.columnNames.length; ++i) {
            var columnName = this.dataSet.attributes.columnNames[i];
            if (this.dataSet.attributes.info[columnName].isDiscrete) {
                $('#select-graph2dalt-group-' + this.id).append('<option value = "' + columnName + '">' + columnName + '</option>');
            }

        }
        
        // menu - layouts
        $('#div-graph2dalt-layout-menu-' + this.id).append('<div id="div-graph2dalt-layout-' + this.id + '">layout: </div>');
        $('#div-graph2dalt-layout-' + this.id).append($('<select id="select-graph2dalt-layout-' + this.id + '" class=' + this.graph2DAltClass + '></select>')
            .css({ 'margin-left': '5px', 'margin-bottom': '5px', 'font-size': '12px', 'width': '80px', 'background-color': '#feeebd' })
            .on("change", function () { changeLayout($(this).val()); }));

        $('#select-graph2dalt-layout-' + this.id).empty();

        for (var layout of ["cose", "cola", "cola-flow"]) {
            var option = document.createElement('option');
            option.text = layout;
            option.value = layout;
            $('#select-graph2dalt-layout-' + this.id).append(option);
        }
                
    }

}
