/* eslint-disable */

(function() {
    window.DrawingInterface = function(root_elem_name, elem_options, submitted_answer) {
        let root_elem = $('#' + root_elem_name);
        let canvas_elem = root_elem.find('canvas')[0];
        let canvas_width = canvas_elem.clientWidth;
        let canvas_height = canvas_elem.clientHeight;
        let html_input = root_elem.find('input');

        /* Set all button icons */
        let drawing_btns = $(root_elem).find("button");
        let image_base_url = elem_options['client_files'];

        drawing_btns.each(function(i, btn) {
            let img = btn.children[0];
            let file_name = img.parentNode.name;
            img.setAttribute("src", image_base_url + file_name + ".png");
        });
        // ================================================================================
        // ================================================================================
        // ================================================================================
        // ================================================================================
        // First we draw all the fixed objects

        var answerName = 'objects';
        if (elem_options.editable) {
            var canvas = new fabric.Canvas(canvas_elem);
        } else {
            var canvas = new fabric.StaticCanvas(canvas_elem);
        }
        canvas.selection = false; // disable group selection
        if (elem_options.grid_size != 0) {
          mechanicsObjects.addCanvasBackground(canvas, elem_options.grid_size);
        }

        // Restrict objects from being able to be dragged off-canvas
        // From: https://stackoverflow.com/questions/22910496/move-object-within-canvas-boundary-limit
        canvas.on('object:moving', function (e) {
            var obj = e.target;
            // if object is too big ignore,
            if (obj.currentHeight > obj.canvas.height ||
                obj.currentWidth > obj.canvas.width) {
                return;
            }
            obj.setCoords();
            // top-left  corner
            if (obj.getBoundingRect().top < 0 || obj.getBoundingRect().left < 0) {
                obj.top = Math.max(obj.top, obj.top-obj.getBoundingRect().top);
                obj.left = Math.max(obj.left, obj.left-obj.getBoundingRect().left);
            }
            // bot-right corner
            if (obj.getBoundingRect().top+obj.getBoundingRect().height > obj.canvas.height ||
                obj.getBoundingRect().left+obj.getBoundingRect().width > obj.canvas.width) {
                obj.top = Math.min(obj.top, obj.canvas.height-obj.getBoundingRect().height+obj.top-obj.getBoundingRect().top);
                obj.left = Math.min(obj.left, obj.canvas.width-obj.getBoundingRect().width+obj.left-obj.getBoundingRect().left);
            }

            /* snap the element to the grid if enabled */
            if (elem_options.snap_to_grid) {
                obj.top = Math.round(obj.top / elem_options.grid_size) * elem_options.grid_size;
                obj.left = Math.round(obj.left / elem_options.grid_size) * elem_options.grid_size;
            }
        });

        let answerData = {};
        let submittedAnswer = {
            'has': function(key) { return key in answerData; },
            'set': function(key, value) {
                answerData[key] = value;
                /* Correctly escape double back-slashes... (\\) */
                let temp = JSON.stringify(answerData).replace("\\\\", "\\\\\\\\");
                html_input.val(temp);
            },
            'get': function(key) { return answerData[key]; }
        };

        if (submitted_answer != null) {
            answerData = submitted_answer;
            mechanicsObjects.restoreSubmittedAnswer(canvas, submittedAnswer, answerName);
        }

        /* Button handlers */
        let handlers = {};

        let arc_vec_options = {
          radius: 30,
          stroke: '#800080',
          strokeWidth: 3,
          originX:'center',
          originY: 'center',
          padding: 30,
          trueHandles: ['mtr'],
          drawCenterPoint:true,
          startAngle: 30,
          endAngle: 230,
          gradingName: 'arc_vector',
          graded: true,
        }

        handlers["pl-arc-vector-CCW"] = function(options) {
            let options2 = _.defaults(options, arc_vec_options);
            let def = {
                left: 0.1*canvas.width,
                top: 0.2*canvas.width,
                drawStartArrow: true,
                drawEndArrow: false,
            };
            let opts = _.defaults(options2, def);
            mechanicsObjects.addArcVector(canvas, opts, submittedAnswer, answerName);
        }

        handlers["pl-arc-vector-CW"] = function(options) {
            let options2 = _.defaults(options, arc_vec_options);
            let def = {
              left: 0.2*canvas.width,
              top: 0.2*canvas.width,
              drawStartArrow: false,
              drawEndArrow: true,
            };
            let opts = _.defaults(options2, def);
            mechanicsObjects.addArcVector(canvas, opts, submittedAnswer, answerName);
        }

        handlers["pl-vector"] = function(options) {
            let def = {
                left: 80, //0.8*canvas.width,
                top: 80, //0.9*canvas.height,
                width: 60,
                stroke: '#b71c0c',
                strokeWidth: 3,
    	          originX:'center',
                originY: 'center',
                padding: 6,
                trueHandles: ['mtr'],
                drawStartArrow: false,
                drawEndArrow: true,
                angle: 0,
                gradingName: 'vector',
                graded: true,
            };
            let opts = _.defaults(options, def);
            mechanicsObjects.addArrow(canvas, opts, submittedAnswer, answerName);
        }

        handlers["pl-double-headed-vector"] = function(options) {
            let def = {
                left: 80,
                top: 40,
                width: 60,
                stroke: '#b71c0c',
                strokeWidth: 3,
                originX:'center',
                originY: 'center',
                padding: 6,
                trueHandles: ['mtr'],
                drawStartArrow: false,
                drawEndArrow: true,
                angle: 0,
                gradingName: 'double_headed_vector',
                graded: true,
            };
            let opts = _.defaults(options, def);
            mechanicsObjects.addDoubleArrow(canvas, opts, submittedAnswer, answerName);
        }

        handlers["pl-point"] = function(options) {
            let def = {
                left: 40, //0.8*canvas.width,
                top: 40, //0.9*canvas.height,
                radius: 4,
                fill: 'blue',
                stroke: 'blue',
                strokeWidth: 1,
    	          originX:'center',
                originY: 'center',
                padding: 12,
                gradingName: 'point',
                graded: true,
            };
            let opts = _.defaults(options, def);
            mechanicsObjects.addCircle(canvas, opts, submittedAnswer, answerName);
        }

        handlers["pl-distributed-load"] = function(options) {
            var width  = 80;
            let def = {
                left: 0.8*canvas.width,
                top: 0.8*canvas.height,
                width: width,
                range: width,
                stroke: '#0057a0',
                strokeWidth: 3,
                spacing: 20,
                w1: 60,
                w2: 60,
                label1: '',
                offsetx1: 0,
                offsety1: 0,
                label2: '',
                offsetx2: 0,
                offsetx2: 0,
                angle: 0,
                anchor_is_tail: false,
                gradingName: 'distTrianLoad',
                graded: true,
            };

            let opts = _.defaults(options, def);
            mechanicsObjects.addDistTrianLoad(canvas, opts, submittedAnswer, answerName);
        }

        var etc = 0; // an easter egg...?
        handlers["pl-controlled-line"] = function(options) {
            let def = {
                x1: 0.5*canvas.width - (etc==1 ? 50 : -50),
                y1: 0.5*canvas.height - 25,
                x2: 0.5*canvas.width - (etc==1 ? 50 : -50),
                y2: 0.5*canvas.height + 25,
                handleRadius: 6,
                strokeWidth: 4,
                stroke: 'red',
                gradingName: "controlledLine",
                graded: true,
            };
            etc = 1.0 - etc;
            let opts = _.defaults(options, def);
	    mechanicsObjects.addControlledLine(canvas, opts, submittedAnswer, answerName);
        };

        handlers["pl-controlled-curved-line"] = function(options) {
            var def = {
                x1: 0.5*canvas.width - 70,
                y1: 0.5*canvas.height + 50,
                x2: 0.5*canvas.width,
                y2: 0.5*canvas.height + 120,
                x3: 0.5*canvas.width + 70,
                y3: 0.5*canvas.height + 50,
                handleRadius: 6,
                strokeWidth: 4,
                stroke: "red",
                gradingName: "controlledCurvedLine",
                graded: true,
            };
            let opts = _.defaults(options, def);
	    mechanicsObjects.addControlledCurvedLine(canvas, opts, submittedAnswer, answerName);
        };

        handlers["help-line"] = function(options) {
            let def = {
                left: 40,
                top: 40,
                x1: 40,
                x2: 140,
                y1: 40,
                y2: 40,
                trueHandles: ['mtr', 'ml', 'mr'],
                stroke: '#0057a0',
                strokeWidth: 1,
                strokeDashArray: [4,4],
                padding: 10,
                graded: false,
            };
            let opts = _.defaults(options, def);
            obj = mechanicsObjects.addLine(canvas, opts, submittedAnswer, answerName);
        }

        handlers["delete"] = function(options) {
      	    if(canvas.getActiveGroup()){
      	        canvas.getActiveGroup().forEachObject(function(o){
                          canvas.remove(o)
                      });
      	        canvas.discardActiveGroup().renderAll();
      	    } else {
      	        canvas.remove(canvas.getActiveObject());
      	    }
        }

        /* Attach click handlers */
        drawing_btns.each(function(i, btn) {
            let id = btn.name;
            let opts = JSON.parse(btn.getAttribute("opts"));

            /* Parse any numerical options from string to floating point */
            for (let key in opts) {
                let parsed = Number(opts[key]);
                if (!isNaN(parsed)) {
                    opts[key] = parsed;
                }
            }

            if (id in handlers) {
                $(btn).click(() => handlers[id](_.clone(opts)));
            }
        });
    }
})()
