var Chart =  (function () {
    function Chart(opt) {
        if (this instanceof Chart) {
            if (!(opt && opt.id)) {
                return;
            }
            this.conf = this.getConfig(this.conf, opt);
            if (opt.id instanceof $) {
                this.canvas = opt.id[0];
            } else {
                this.canvas = document.getElementById(opt.id);
            }
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = this.conf.width;
            this.canvas.height = this.conf.height;
            this.init && this.init();
        } else {
            new Chart(opt);
        }
    }
    $.extend(Chart.prototype, {
        conf: {
            id: '',
            width: 362, // 画布宽度
            height: 288, // 画布高度
            bgcolor: '#f9fafe', // 画布颜色
            animate: true, // 性能不好的设备可以考虑不要动画
            title: {
                text: '',// 主标题
                x: 26, // 标题X坐标
                y: 24, // 标题Y坐标
                fontSize: 14, // 标题字体大小
                fontFamliy: 'Arial',
                fontColor: '#000000'// 主标题颜色
            },
            colors: [],
            needtips: true,
            // 数据
            series: {
                decimal: 1,
                data: []
            }
        },
        // 合并配置
        getConfig: function (src, opt) {
            var conf = $.extend({}, src, opt);
            for (var i in conf) {
                if (conf.hasOwnProperty(i) && $.isPlainObject(conf[i])) {
                    conf[i] = this.getConfig(src[i], opt[i]);
                }
            }
            return conf;
        },
        // 画背景
        fillRect: function (x, y, width, height) {
            this.ctx.fillStyle = this.conf.bgcolor;
            this.ctx.fillRect(x, y, width, height);
        },
        getRelativePosition: function (e) {
            var mouseX;
            var mouseY;
            var canvas = e.target;
            var boundingRect = canvas.getBoundingClientRect();
            if (e.touches) {
                mouseX = e.touches[0].clientX - boundingRect.left;
                mouseY = e.touches[0].clientY - boundingRect.top;
            } else {
                mouseX = e.clientX - boundingRect.left;
                mouseY = e.clientY - boundingRect.top;
            }
            return {
                x: mouseX,
                y: mouseY
            };
        },
        getNumber: function (number, decimal) {
            decimal = decimal === undefined ? 0 : decimal;
            return +(Math.floor((number + 5 / Math.pow(10, decimal + 1))
                    * Math.pow(10, decimal)) / Math.pow(10, decimal));
        },
        paintText: function (params) {
            if (params.text) {
                var ctx = this.ctx;
                ctx.font = params.font || '12px Arial';
                ctx.fillStyle = params.fillStyle || '#616669';
                ctx.textAlign = params.textAlign || 'center';
                ctx.textBaseline = params.textBaseline || 'middle';
                ctx.fillText(params.text, params.x, params.y);
                ctx.restore();
            }
        },
        paintTitle: function () {
            var title = this.conf.title;
            var params = {
                text: title.text,
                font: title.fontSize + 'px ' + title.fontFamliy,
                fillStyle: title.fontColor,
                x: title.x,
                y: title.y,
                textAlign: 'left',
                textBaseline: 'bottom'
            };
            this.paintText(params);
        },
        bindEvent: function () {
            var t = this;
            $(t.canvas).on('mousemove', function (e) {
                var content = t.getAreaData(e);
                content ? t.showLayer(e, content) : t.hideLayer();
            });
            t.tipLayer.on('mouseenter', function (e) {
                $(this).hide();
            });
        },
        destory: function (e) {
            $(this.canvas).off('mousemove');
        },
        showLayer: function (e, content) {
            var canvas = e.target;
            var offsetY = $(canvas).offset().top + e.offsetY - (this.tipLayer.height() / 2);
            this.tipLayer.css({top: offsetY, left: e.clientX + 20}).html(content).show();
        },
        hideLayer: function () {
            this.tipLayer.hide();
        }
    });
    // 模拟类的行为
    Chart.extend = function (protoProps, staticProps) {
        var parent = this;
        var Child;

        if (protoProps && protoProps.hasOwnProperty('constructor')) {
            // 使用新的构造函数
            Child = protoProps.constructor;
        } else {
            // 使用父类的构造函数
            Child = function () {
                return parent.apply(this, arguments);
            };
        }

        var Surrogate = function () {
            this.constructor = Child;
        };
        Surrogate.prototype = parent.prototype;
        Child.prototype = new Surrogate();

        $.extend(Child.prototype, protoProps);
        $.extend(Child, parent, staticProps);
        Child.__super__ = parent.prototype;

        return Child;
    };
    var pieChart = Chart.extend({
        conf: Chart.prototype.getConfig(Chart.prototype.conf, {
            title: {
                subtext: '',// 次标题
                subtextColor: '#cccccc' // 次标题颜色
            },
            colors: ['#ff1a47', '#00e29f', '#00c964', '#ff792e', '#7bc0e0'],
            unit: {
                names: ['元', '万元', '亿元'],// 数值单位
                scales: [1, 10000, 100000000] // 数值单位刻度
            },
            // 画布外心圆形
            outercircle: {
                radius: 0,
                color: '#cccccc'
            },
            // 画布内心圆
            innercircle: {
                radius: 0,
                opacity: 0.35,
                name: '',
                fontSize: 11,
                color: '#ffffff',
                fontFamliy: 'Arial'
            },
            // 数据
            series: {
                radius: 60,// 饼图半径
                angle: 0
            }
        }),
        init: function () {
            var t = this;
            t.translateY = 20;// 坐标系整体平移像素
            t.coord = {
                x: t.conf.width / 2,
                y: t.conf.height / 2 + t.translateY
            };
            t.calculate();
            t.paint();
            // 是否有tips层
            if (t.conf.needtips) {
                var html = '<div style="width: 86px;display: none;position: absolute;background: #000;'
                    +      'border-radius: 5px;opacity: 0.5;height: 50px;"></div>';
                t.tipLayer = $(html).appendTo($(document.body));
                t.bindEvent();
            }
        },
        calculate: function () {
            var series = this.conf.series;
            var data = series.data;
            var effectiveData = [];// 有效数据
            var total = 0; // 数值总和
            var tmpVal; // 临时数据存放
            var maxFlag = 0; // 最大数字位置
            var minFlag = 0; // 最小数字位置
            var maxValue = 0; // 最大数字
            var minValue = 0; // 最小数字
            var totalPercent = 0;// 存储总和比例
            var colorLen = this.conf.colors.length;
            for (var i = 0, _len = data.length; i < _len; i++) {
                tmpVal = parseInt(data[i]['value'], 10);
                if (!isNaN(tmpVal)) {
                    total += tmpVal;
                    effectiveData.push(data[i]);
                }
            }
            for (var j = 0, _len = effectiveData.length; j < _len; j++) {
                if (j === 0) {
                    maxValue = minValue = effectiveData[0]['value'];
                } else {
                    if (effectiveData[j]['value'] > maxValue) {
                        maxValue = effectiveData[j]['value'];
                        maxFlag = j;
                    }
                    if (minValue > effectiveData[j]['value']) {
                        minValue = effectiveData[j]['value'];
                        minFlag = j;
                    }
                }
                var num = this.getNumber(effectiveData[j]['value'] / total * 100, series.decimal);
                totalPercent = totalPercent + num;
                effectiveData[j]['percentage'] = num;
                effectiveData[j]['color'] = this.conf.colors[j % colorLen];
            }
            // 数据矫正
            if (totalPercent > 100) {
                effectiveData[maxFlag]['percentage'] = effectiveData[maxFlag]['percentage'] - totalPercent + 100;
            } else if (totalPercent < 100) {
                effectiveData[minFlag]['percentage'] = effectiveData[minFlag]['percentage'] - totalPercent + 100;
            }
            /** 
              * 为什么需要单独再次循环，1、所有占用的百分比之和未必是100%，需要进行一次修正，如果在上一个循环中
              * 计算的话需要，在fixed的时候分配角度范围；2、为啥不存储初始化角度 + 转角？每次移动的时候需要重新计算
              * 因此直接一次性算好,这里存储的是弧度
            **/
            var startAngle = this.conf.series.angle;
            for (var i = 0, _len = effectiveData.length; i < _len; i++) {
                effectiveData[i].startAngle = startAngle;
                // 计算end 实际弧度
                startAngle += effectiveData[i]['percentage'] / 100 * Math.PI * 2;
                effectiveData[i].endAngle = startAngle;
                effectiveData[i].centerAngle = effectiveData[i].startAngle + (effectiveData[i].endAngle - effectiveData[i].startAngle) / 2;
                effectiveData[i].formatVal = this.formatValue(effectiveData[i]['value']);
            }
            this.conf.drawData = effectiveData;
        },
        // 根据数据格式化
        formatValue: function (val) {
            var unit = this.conf.unit;
            if (unit.names.length === unit.scales.length) {
                for (var i = unit.scales.length - 1; i >= 0; i--) {
                    if (val / unit.scales[i] > 1) {
                        return this.getNumber(val / unit.scales[i], 1) + unit.names[i];
                    }
                }
            }
            return val;
        },
        // 开始绘制
        paint: function () {
            var t = this;
            // 绘制背景色
            t.fillRect(0, 0, t.conf.width, t.conf.height);
            // 主标题
            t.paintTitle();
            // 附标题
            t.paintSubTitle();
            var conf = t.conf;
            t.maxRadius = Math.max(conf.outercircle.radius, conf.series.radius);
            var clearX = t.coord.x - t.maxRadius;
            var clearY = t.coord.y - t.maxRadius;
            if (t.conf.animate) {
                t.paintAnimatePie(clearX, clearY);
            } else {
                t.paintPie(conf.series.radius, clearX, clearY, 1);
                t.paintMark();
            }
        },
        paintAnimatePie: function (clearX, clearY) {
            var t = this;
            var conf = t.conf;
            var stepRadius = 0.1 * conf.series.radius;
            var step = 2; // 步长

            var stepAngle = 1;// 弧度开始步长
            // 算运动次数
            var totalStep = parseInt((t.maxRadius - stepRadius) / step + (t.maxRadius - t.conf.series.radius) / step, 10);
            // 记录运动步数
            function angleAnimate() {
                var timer = setTimeout(function () {
                    // 绘制文本
                    t.paintAnimateMark(stepAngle / totalStep);
                    if (stepAngle > totalStep) {
                        clearTimeout(timer);
                        stepAngle = totalStep;
                    } else {
                        stepAngle++;
                        angleAnimate();
                    }
                }, 1000 / 60);
            }
            function pieBigAnimate() {
                var timer = setTimeout(function () {
                    if (stepRadius >= t.maxRadius) {
                        clearTimeout(timer);
                        t.paintPie(t.conf.series.radius, clearX, clearY, 1);
                        // pieSmallAnimate();
                    } else {
                        stepRadius += step;
                        t.paintPie(stepRadius, clearX, clearY, stepAngle / totalStep);
                        pieBigAnimate();
                    }
                }, 1000 / 60);
            }
            // function pieSmallAnimate() {
            //     var timer = setTimeout(function () {
            //         if (stepRadius <= t.conf.series.radius ) {
            //             clearTimeout(timer);
            //             t.paintPie(t.conf.series.radius, clearX, clearY, stepAngle / totalStep);
            //         } else {
            //             stepRadius -= step;
            //             t.paintPie(stepRadius, clearX, clearY, stepAngle / totalStep);
            //             pieSmallAnimate();
            //         }
            //     }, 20);
            // }
            // 绘制资金信息
            t.paintMark(0);
            // 绘制动态放大缩小的圆形
            pieBigAnimate();
            // 绘制动态变大的弧度
            angleAnimate();
        },
        // 绘制饼图
        paintPie: function (radius, clearX, clearY, ratio) {
            var conf = this.conf;
            this.fillRect(clearX, clearY, 2 * this.maxRadius, 2 * this.maxRadius);
            if (conf.outercircle.radius) {
                this.paintOuterCicle(radius * conf.outercircle.radius / conf.series.radius);
            }
            if (conf.series.data.length) {
                this.paintCircle(radius, ratio);
            }
            if (conf.innercircle && conf.innercircle.name) {
                this.paintInnerCircle(radius * conf.innercircle.radius / conf.series.radius);
            }
            // 防止画内心圆的时候将ctx的透明更改
            this.ctx.globalAlpha = 1;
        },
        // 绘制动画辅助提示信息
        paintAnimateMark: function (ratio) {
            ratio = ratio > 1 ? 1 : ratio;
            var data = this.conf.drawData;
            var params;
            for (var i = 0, _len = data.length; i < _len; i++) {
                this.fillRect(data[i]['clearCoord'].clearx, data[i]['clearCoord'].cleary,
                    data[i]['clearCoord'].width, data[i]['clearCoord']['height']);
                params = {
                    text: parseInt(ratio * data[i]['percentage'], 10) + '%',
                    fillStyle: data[i].color,
                    x: data[i]['clearCoord']['x'],
                    y: data[i]['clearCoord']['y']
                };
                this.paintText(params);
            }
            // this.paintMark(ratio);

        },
        // 绘制辅助提示信息 initVal 绘制初始值
        paintMark: function (initValue) {
            var conf = this.conf;
            var cornerPoint;
            for (var i = 0, _len = conf.drawData.length; i < _len; i++) {
                // 画外围线了
                cornerPoint = this.getCornerPoint(conf.drawData[i].centerAngle);
                this.drawAvgPoint(cornerPoint, conf.drawData[i].color);
                this.drawContentTip(conf.drawData[i], cornerPoint, initValue);
            }
        },
        // 绘制内容
        drawContentTip: function (data, cornerPoint, initValue) {
            // 饼图左侧
            var fontSize = 12;
            var x, y;
            var wordWidth = data.name.length * fontSize / 2;
            if (cornerPoint.sx >= cornerPoint.ex) {
                x = cornerPoint.ex - wordWidth;
            } else {
                x = cornerPoint.ex + wordWidth;
            }
            y = cornerPoint.ey - 18;
            // this.ctx.arc(cornerPoint.x, cornerPoint.y, 2, 0, 2 *Math.PI);
            var nameParams = {
                text: data['name'],
                x: x,
                y: y
            };
            this.paintText(nameParams);
            var params = {
                text: (initValue === 0 ? 0 : data['percentage']) + '%',
                fillStyle: data.color,
                x: x,
                y: y + 18
            }
            // x，y 绘制文本的坐标点， clearx,y:清理文本的起始点
            data['clearCoord'] = {x: x, y: y + 18, clearx: x - wordWidth + 2, cleary: y + fontSize, width: wordWidth * 2, height: fontSize};
            this.paintText(params);
            var foundParams = {
                text: data['formatVal'],
                x: x,
                y: y + 34
            };
            this.paintText(foundParams);
        },
        // 绘制圆形，根据ratio系数绘制角度 * 几分之一
        paintCircle: function (radius, ratio) {
            var ctx = this.ctx;
            var series = this.conf.series;
            radius = radius > this.maxRadius ? this.maxRadius : radius;

            var drawData = this.conf.drawData;
            var colorsLen = this.conf.colors.length;
            for (var i = 0, _len = drawData.length; i < _len; i++) {
                ctx.beginPath();
                ctx.moveTo(this.coord.x, this.coord.y);
                ctx.arc(this.coord.x, this.coord.y, radius,
                        drawData[i].startAngle * ratio, 
                        drawData[i].endAngle * ratio);
                ctx.fillStyle = drawData[i].color;
                // ctx.closePath();
                ctx.fill();
            }
        },
        // 画外心圆
        paintOuterCicle: function (radius) {
            var conf = this.conf.outercircle;
            var ctx = this.ctx;
            radius = radius > this.maxRadius ? this.maxRadius : radius;
            ctx.beginPath();
            ctx.arc(this.coord.x, this.coord.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = conf.color;
            ctx.stroke();
        },
        // 画内心圆
        paintInnerCircle: function (radius) {
            var conf = this.conf.innercircle;
            var ctx = this.ctx;
            radius = radius > this.maxRadius ? this.maxRadius : radius;
            var names = [];
            var index = 0;
            if (conf.name.length > 3) {
                index = parseInt(conf.name.length / 2, 10);
                names.push(conf.name.substr(0, index));
                names.push(conf.name.substr(index));
            } else {
                names.push(conf.name);
            }
            var params = {
                font: conf.fontSize + 'px ' + conf.fontFamliy,
                fillStyle: conf.color,
                x: this.coord.x
            };
            if (names.length === 1) {
                params.text = names[0];
                params.y = this,coord.y;
                this.paintText(params);
            } else {
                params.text = names[0];
                params.y = this.coord.y - 2 - conf.fontSize / 2;
                this.paintText(params);

                params.text = names[1];
                params.y = this.coord.y + 2 + conf.fontSize / 2;
                this.paintText(params);
            }
            ctx.beginPath();
            ctx.arc(this.coord.x, this.coord.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = conf.opacity;
            ctx.fill();
        },
        paintSubTitle: function () {
            var title = this.conf.title;
            var x = title.x + title.text.length * title.fontSize + 10;
            var params = {
                text: title.subtext,
                font: title.fontSize + 'px ' + title.fontFamliy,
                fillStyle: title.subtextColor,
                x: x,
                y: title.y,
                textAlign: 'left',
                textBaseline: 'bottom'
            };
            this.paintText(params);
        },
        // 绘制引脚
        drawAvgPoint: function (cornerPoint, color) {
            var ctx = this.ctx;
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.moveTo(cornerPoint.sx, cornerPoint.sy);
            ctx.lineTo(cornerPoint.cx, cornerPoint.cy);
            ctx.moveTo(cornerPoint.cx, cornerPoint.cy);
            ctx.lineTo(cornerPoint.ex, cornerPoint.ey);
            // ctx.closePath();
            ctx.stroke();
            ctx.fillStyle = color;
            ctx.arc(cornerPoint.ex, cornerPoint.ey, 2, 0, 2 * Math.PI);
            ctx.fill();
        },
        // 获取绘制引脚的坐标点
        getCornerPoint: function (arcAngle) {
            var newAngle = arcAngle;// 计算sin需要弧度的转角
            switch (true) {
                case arcAngle >= Math.PI * 3 / 2:
                    newAngle = 2 * Math.PI - arcAngle;
                    break;
                case arcAngle >= Math.PI:
                    newAngle = arcAngle - Math.PI;
                    break;
                case arcAngle >= Math.PI / 2:
                    newAngle = Math.PI - arcAngle;
                    break;
            }

            var r = this.conf.series.radius;
            var sinAngle = Math.sin(newAngle);
            var y = sinAngle * r;
            var x = Math.sqrt(r * r - y * y);
            var coordx = this.coord.x;
            var coordy = this.coord.y;
            y += 12;
            x += 12;
            var newx, newy;
            var cornerPoint;
            switch (true) {
                // 第一象限
                case arcAngle >= Math.PI * 3 / 2:
                    newx = coordx + x;
                    newy = coordy - y;
                    cornerPoint = {
                        sx: newx,
                        sy: newy,
                        cx: newx + 20,
                        cy: newy - 20,
                        ex: newx + 30,
                        ey: newy - 20
                    };
                    break;
                // 第二象限
                case arcAngle >= Math.PI:
                    newx = coordx - x;
                    newy = coordy - y;
                    cornerPoint = {
                        sx: newx,
                        sy: newy,
                        cx: newx - 20,
                        cy: newy - 20,
                        ex: newx - 30,
                        ey: newy - 20
                    };
                    break;
                // 第三象限
                case arcAngle >= Math.PI / 2:
                    newx = coordx - x;
                    newy = coordy + y;
                    cornerPoint = {
                        sx: newx,
                        sy: newy,
                        cx: newx - 20,
                        cy: newy + 20,
                        ex: newx - 30,
                        ey: newy + 20
                    };
                    break;
                // 第四象限
                default:
                    newx = coordx + x;
                    newy = coordy + y;
                    cornerPoint = {
                        sx: newx,
                        sy: newy,
                        cx: newx + 20,
                        cy: newy + 20,
                        ex: newx + 30,
                        ey: newy + 20
                    };
            }
            return cornerPoint;
        },
        // 获取坐标系坐标
        getCoord: function (x, y) {
            return {
                x: x - this.conf.width / 2,
                y: this.conf.height / 2 - y + this.translateY
            };
        },
        // 获取鼠标所在区域
        getAreaData: function (e) {
            var mouse = this.getRelativePosition(e);
            var co = this.getCoord(mouse.x, mouse.y);
            var r = Math.sqrt(co.x * co.x + co.y * co.y);
            var conf = this.conf;
            var arcAngle = this.getArcAngle(co);
            var html;
            // 在圆内
            if (r < conf.series.radius) {
                for (var i = 0, _len = conf.drawData.length; i < _len; i++) {
                    if (arcAngle >= conf.drawData[i].startAngle && arcAngle <= conf.drawData[i].endAngle) {
                        html = '<p style="color:#fff;margin:5px 5px;">' + conf.drawData[i].name
                        +      '</p><p style="color:#fff;margin:5px 5px;">' + conf.drawData[i].formatVal + '</p>';
                        break;
                    }
                }
            }
            return html;
        },
        // 获取弧度
        getArcAngle: function (co) {
            var r = Math.sqrt(co.x * co.x + co.y * co.y);
            var arcAngle =  Math.asin(co.y / r);
            switch (true) {
                // 二三象限
                case co.x <= 0:
                    arcAngle = Math.PI - arcAngle;
                    break;
                // 四象限
                case co.x > 0 && co.y < 0:
                    arcAngle = 2 * Math.PI + arcAngle;
                    break;
            }
            return Math.PI * 2 - arcAngle;
        }
    });
    var columnChart = Chart.extend({
        conf: Chart.prototype.getConfig(Chart.prototype.conf, {
            margin: 30, // 上下左右margin
            horizonmargin: 16, // 坐标轴线两端距离
            columnwidth: 30, // 柱宽度
            maxheight: 42, // 柱表最大高度
            colors: ['#f04b5b', '#2abd64'],
            unit: {
                defaultname: '万元',
                names: ['元', '万元', '亿元'],// 数值单位
                scales: [1, 10000, 100000000] // 数值单位刻度
            },
            // 数据
            series: {
                mark: true, // 五日需要底部的mark
                dataformat: '' // 数据格式
            }
        }),
        init: function () {
            this.coord = {
                x: 0,
                y: this.conf.height / 2
            };
            this.calculate();
            this.paint();
            // 是否有tips层
            if (this.conf.needtips) {
                var html = '<div style="width: 86px;display: none;position: absolute;background: #000;'
                    +      'border-radius: 5px;opacity: 0.5;height: 50px;"></div>';
                this.tipLayer = $(html).appendTo($(document.body));
                this.bindEvent();
            }
        },
        calculate: function () {
            var conf = this.conf;
            var data = conf.series.data;
            var effectiveData = [];// 有效数据
            var total = 0; // 数值总和
            var tmpVal = 0;
            var maxValue = 0;
            for (var i = 0, _len = data.length; i < _len; i++) {
                tmpVal = Math.abs(data[i]['value']);
                if (!!tmpVal) {
                    maxValue = maxValue > tmpVal ? maxValue : tmpVal;
                    total += tmpVal;
                    effectiveData.push(data[i]);
                }
            }
            // 设置辅助线的默认文案
            var unitIndex = this.getUnitIndex(maxValue);
            conf.unit.defaultname = conf.unit.names[unitIndex];

            var _len = effectiveData.length;
            var availableWidth = this.conf.width - 2 * (this.conf.margin + this.conf.horizonmargin);
            var marginWidth = (availableWidth - _len * this.conf.columnwidth) / (_len - 1);
            if (marginWidth < 0) {
                this.conf.columnwidth /= 2;
                marginWidth = (availableWidth - _len * this.conf.columnwidth) / (_len - 1);
                if (marginWidth < 0) {
                    throw '数据列过多';
                }
            }
            var  height = 0;
            for (var j = 0; j < _len; j++) {
                height = parseInt(Math.abs(effectiveData[j]['value']) / maxValue * conf.maxheight);
                effectiveData[j]['formatVal'] = this.getNumber(effectiveData[j]['value'] / conf.unit.scales[unitIndex], conf.series.decimal).toFixed(conf.series.decimal);
                

                effectiveData[j]['height'] = height > 0 ? height : 1;
                effectiveData[j]['point'] = this.getColumnPoint(effectiveData[j]['height'], j, effectiveData[j]['value'], marginWidth);
                effectiveData[j]['color'] = effectiveData[j]['value'] > 0 ? this.conf.colors[0] : this.conf.colors[1];
            }
            this.conf.drawData = effectiveData;
        },
        // 获取矩形的起始点
        getColumnPoint: function (height, index, value, marginwidth) {
            var point = {};
            point.x = this.conf.margin + this.conf.horizonmargin + index * (marginwidth + this.conf.columnwidth);
            if (value >= 0) {
                point.y = this.coord.y - height;
            } else {
                point.y = this.coord.y;
            }
            return point;
        },
        paintAnimateColumn: function () {
            var t = this;
            var data =  t.conf.drawData;
            var startStep = 1;
            var totalStep = 20;
            var ctx = this.ctx;
            function animate() {
                var timer = setTimeout(function() {
                    if (startStep > totalStep) {
                        clearTimeout(timer);
                    } else {
                        animateRect();
                        startStep++;
                        animate();
                    }
                }, 1000 / 60);
            }
            function animateRect() {
                var ratio = startStep / totalStep;
                for (var i = 0, _len = data.length; i < _len; i++) {
                    if (data[i]['value'] >= 0) {
                        var y =  data[i]['point']['y'] + (1 - ratio) * data[i]['height'];
                        t.paintRect(ctx, data[i]['point']['x'], y
                                , data[i].height * ratio,
                                data[i].color, t.getNumber(data[i]['formatVal'] * ratio, t.conf.series.decimal).toFixed(t.conf.series.decimal));
                    } else {
                        t.paintRect(ctx, data[i]['point']['x'], data[i]['point']['y']
                                , data[i].height * ratio,
                                data[i].color, t.getNumber(data[i]['formatVal'] * ratio, t.conf.series.decimal).toFixed(t.conf.series.decimal));
                    }
                }
            }
            animate();
        },
        paintColumn: function () {
            var ctx = this.ctx;
            var data = this.conf.drawData;
            for (var i = 0, _len = data.length; i < _len; i++) {
                this.paintRect(ctx, data[i]['point']['x'], data[i]['point']['y']
                            , data[i].height, data[i].color, data[i]['formatVal']);
            }
        },
        paintRect: function (ctx, x, y, height, color, value) {
            // 清理上一次画好的
            this.fillRect(x - 6, this.coord.y + (value > 0 ? 5 : -17), 36, 12);
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.fillRect(x, y, this.conf.columnwidth, height);
            var params = {
                text: value + this.conf.series.dataformat,
                fillStyle: color,
                x: x + this.conf.columnwidth / 2, // 文本放中间
                y: this.coord.y + (value > 0 ? 11 : -11) // 跟水平线相距5px
            };
            this.paintText(params);
        },
        getUnitIndex: function (val) {
            var unit = this.conf.unit;
            var index = 0;
            if (unit.names.length === unit.scales.length) {
                for (var i = unit.scales.length - 1; i >= 0; i--) {
                    if (val / unit.scales[i] > 1) {
                        return i;
                    }
                }
            }
            return index;
        },
        // 开始绘制
        paint: function () {
            var t = this;
            var conf = t.conf;
            // 绘制背景色
            t.fillRect(0, 0, conf.width, conf.height);
            // 主标题
            t.paintTitle();
            // 画中轴线
            var ctx = t.ctx;
            ctx.beginPath();
            ctx.strokeStyle = '#cccccc';
            ctx.moveTo(t.conf.margin, t.coord.y);
            ctx.lineTo(conf.width - t.conf.margin, t.coord.y);
            ctx.closePath();
            ctx.stroke();
            if (t.conf.animate) {
                t.paintAnimateColumn();
            } else {
                t.paintColumn();
            }
            // 是否有底部标记
            if (t.conf.series.mark) {
                t.paintMark();
            }
        },
        paintMark: function () {
            var ctx = this.ctx;
            var markY =  this.conf.height - this.conf.margin;
            // 蓝点
            ctx.beginPath();
            ctx.fillStyle = this.conf.colors[1];
            ctx.arc(this.conf.margin, markY, 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.closePath();
            var foundin = {
                text: '资金流出',
                x: this.conf.margin + 6,
                y: markY,
                textAlign: 'left'
            };
            this.paintText(foundin);
            // 红点
            ctx.beginPath();
            ctx.fillStyle = this.conf.colors[0];
            ctx.arc(this.conf.margin + 66, markY, 2, 0, 2 * Math.PI);
            ctx.fill();
            var foundout =  {
                text: '资金流入',
                x: this.conf.margin + 72,
                y: markY,
                textAlign: 'left'
            };
            this.paintText(foundout);
            // 单位
            var unit = {
                text: '单位（' + this.conf.unit.defaultname + '）',
                x: this.conf.width - this.conf.margin,
                y: markY,
                textAlign: 'right'
            };
            this.paintText(unit);
        },
        // 获取鼠标所在区域
        getAreaData: function (e) {
            var mouse = this.getRelativePosition(e);
            var conf = this.conf;
            var data = conf.drawData;
            var html;
            for (var i = 0, _len = data.length; i < _len; i++) {
                if (mouse.x >= data[i]['point']['x']
                    && mouse.x <= data[i]['point']['x'] + this.conf.columnwidth
                    && mouse.y >= data[i]['point']['y']
                    && mouse.y <= data[i]['point']['y'] + data[i]['height']) {
                    html = '<p style="color:#fff;margin:5px 5px;">' + data[i].name
                        + '</p><p style="color:#fff;margin:5px 5px;">' + data[i].formatVal
                        + (conf.series.dataformat ? conf.series.dataformat : conf.unit.defaultname) + '</p>';
                    break;
                }
            }
            return html;
        }
    });
    return {
        pieChart: pieChart,
        columnChart: columnChart
    };
})();
