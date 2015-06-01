function pieChart(opt) {
    if (this instanceof pieChart) {
        if (!opt || !opt.id) return;
        this.init(opt);
    } else {
        new pieChart();
    }
}
pieChart.prototype = {
    conf: {
        width: 362, // 画布宽度
        height: 288, // 画布高度
        bgcolor: '#f9fafe', // 画布颜色
        animate: true, // 性能不好的设备可以考虑不要动画
        title: {
            text: '',// 主标题
            subtext: '',// 次标题
            x: 26, // 标题X坐标
            y: 24, // 标题Y坐标
            fontSize: 14, //标题字体大小
            fontFamliy : 'Arial',
            fontColor: '#000000', // 主标题颜色
            subtextColor: '#cccccc' // 次标题颜色
        },
        colors: ['#ff1a47', '#00e29f', '#00c964', '#ff792e', '#7bc0e0'],
        unit: {
            names: [],// 数值单位
            scales: [] // 数值单位刻度
        },
        // 画布外心圆形
        outercircle:{
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
        needtips: true,
        tipfunc: null,
        // 数据
        series: {
            radius: 60,//饼图半径
            decimal: 2,
            angle: 0,
            data: []
        }
    },
    init: function (opt) {
        if(opt.id instanceof $) {
           this.canvas = opt.id[0];
        } else {
           this.canvas = document.getElementById(opt.id);
        }
        this.ctx = this.canvas.getContext("2d");
        this.getConfig(opt);
        this.retinaScale();
        this.coord = {
            x: this.conf.width / 2,
            y: this.conf.height / 2
        };
        this.calculate();
        this.paint();
        // 是否有tips层
        if (this.conf.needtips) {
            var html = "<div style='width: 200px;display: none;position: absolute;background: #ffffff;opacity: 0.5;height: 80px;'>";
            this.tipLayer = $(html).appendTo($(document.body));
            this.bindEvent();
        }
    },
    // 合并配置
    getConfig: function(opt) {
        for (var i in this.conf) {
            if (i && opt.hasOwnProperty(i) && this.conf.hasOwnProperty(i)
                && $.isPlainObject(opt[i])) {
                this.conf[i] = $.extend({}, this.conf[i], opt[i]);
            } else if(opt[i] !== undefined){
                this.conf[i] = opt[i];
            }
        }
    },
    // 重新设置缩放比例
    retinaScale : function() {
        var scaleRatio = Math.min(window.devicePixelRatio, 2);
        this.scaleRatio = scaleRatio = isNaN(scaleRatio) ? 1 : scaleRatio;
        if (scaleRatio === 1) {
            this.canvas.width = this.conf.width;
            this.canvas.height = this.conf.height;
        } else {
            this.canvas.width = this.conf.width * scaleRatio;
            this.canvas.height = this.conf.height * scaleRatio;
            $(this.canvas).css({width: this.canvas.width, height:this.canvas.height});
            this.ctx.scale(scaleRatio, scaleRatio);
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
        for (var i = 0, _len = data.length; i< _len; i++) {
            tmpVal = parseInt(data[i].value);
            if (!isNaN(tmpVal)) {
                total += tmpVal;
                effectiveData.push(data[i]);
            }
        }
        for (var j = 0, _len = effectiveData.length; j < _len; j++) {
            if (j === 0) {
                maxValue = minValue = effectiveData[0].value;
            } else {
                if (effectiveData[j].value > maxValue) {
                    maxValue = effectiveData[j].value;
                    maxFlag = j;
                }
                if (minValue > effectiveData[j].value) {
                    minValue = effectiveData[j].value;
                    minFlag = j;
                }
            }
            var num = this.getNumber(effectiveData[j].value / total * 100, series.decimal);
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
            effectiveData[i].nameAngle = effectiveData[i].startAngle + (effectiveData[i].endAngle - effectiveData[i].startAngle) / 2;
            effectiveData[i].formatVal = this.formatValue(effectiveData[i].value);
        }
        this.conf.drawData = effectiveData;
    },
    // 根据数据格式化
    formatValue: function (val) {
        var unit = this.conf.unit;
        if (unit.names.length == unit.scales.length) {
            for (var i = unit.scales.length - 1; i >= 0; i--) {
                if (val / unit.scales[i] > 1) {
                    return this.getNumber(val / unit.scales[i], 1) + unit.names[i];
                    break;
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
        t.maxRadius = Math.max(conf.outercircle.radius, conf.series.radius) * 1.1;
        var clearX = t.coord.x - t.maxRadius;
        var clearY = t.coord.y - t.maxRadius;
        if (t.conf.animate) {
            t.paintAnimatePie(clearX, clearY);
        } else {
            t.paintPie(conf.series.radius, clearX, clearY, 1);
            t.paintNames();
        }
    },
    paintAnimatePie: function (clearX, clearY) {
        var t = this;
        var conf = t.conf;
        var stepRadius = 0.5 * conf.series.radius;
        var step = 2; // 步长

        var stepAngle = 1;//弧度开始步长
        // 算运动次数
        var totalStep = parseInt((t.maxRadius - stepRadius) / step + (t.maxRadius - t.conf.series.radius) / step);
        function angleAnimate() {
            var timer = setTimeout(function () {
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
                if (stepRadius > t.maxRadius) {
                    clearTimeout(timer);
                    pieSmallAnimate();
                } else {
                    stepRadius += step;
                    t.paintPie(stepRadius, clearX, clearY, stepAngle / totalStep);
                    pieBigAnimate();
                }
            }, 1000 / 60);
        }
        function pieSmallAnimate() {
            var timer = setTimeout(function () {
                if (stepRadius <= t.conf.series.radius ) {
                    clearTimeout(timer);
                    t.paintPie(t.conf.series.radius, clearX, clearY, stepAngle / totalStep);
                } else {
                    stepRadius -= step;
                    t.paintPie(stepRadius, clearX, clearY, stepAngle / totalStep);
                    pieSmallAnimate();
                }
            }, 20);
        }
        // 绘制动态放大缩小的圆形
        pieBigAnimate();
        // 绘制动态变大的弧度
        angleAnimate();
    },
    // 绘制饼图
    paintPie: function (radius, clearX, clearY, ratio) {
        var conf = this.conf;
        this.fillRect(clearX - 1, clearY - 1, 2 * this.maxRadius + 2, 2 * this.maxRadius + 2);
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
    // 画names列表
    paintNames: function () {

    },
    // 画背景
    fillRect: function (x, y, width, height) {
        this.ctx.fillStyle = this.conf.bgcolor;
        this.ctx.fillRect(x, y, width, height);
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
    paintOuterCicle: function(radius) {
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
            index = parseInt(conf.name.length / 2);
            names.push(conf.name.substr(0, index));
            names.push(conf.name.substr(index));
        } else {
            names.push(conf.name);
        }
        var params = {
            font: conf.fontSize + 'px ' + conf.fontFamliy,
            fillStyle: conf.color,
            x: this.coord.x,
            textAlign: 'center',
            textBaseline: 'middle'
        };
        if (names.length == 1) {
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
    paintText: function (params) {
        var ctx = this.ctx;
        ctx.font = params.font;
        ctx.fillStyle = params.fillStyle;
        ctx.textAlign = params.textAlign || 'left';
        ctx.textBaseline = params.textBaseline || 'bottom';
        ctx.fillText(params.text, params.x, params.y);
        ctx.restore();
    },
    paintTitle: function () {
        var title = this.conf.title;
        var params = {
            text: title.text,
            font: title.fontSize + 'px ' + title.fontFamliy,
            fillStyle: title.fontColor,
            x: title.x,
            y: title.y
        };
        this.paintText(params);
    },
    paintSubTitle: function () {
        var title = this.conf.title;
        var x = title.x + title.text.length * title.fontSize + 10;
        var params = {
            text: title.subtext,
            font: title.fontSize + 'px ' + title.fontFamliy,
            fillStyle: title.subtextColor,
            x: x,
            y: title.y
        };
        this.paintText(params);
    },
    getNumber: function (number, decimal) {
        decimal = decimal === undefined ? 0 : decimal;
        return +(Math.floor((number + 5 / Math.pow(10, decimal + 1))
                * Math.pow(10, decimal)) / Math.pow(10, decimal)).toFixed(decimal)
    },
    bindEvent: function () {
        var t = this;
        $(t.canvas).on('mousemove', function (e) {
            var data = t.getAreaData(e);
            if (t.conf.tipfunc && typeof t.conf.tipfunc === 'function') {
                t.conf.tipfunc(data);
            } else {
                if (data) {
                    t.show(e, data)
                } else {
                    t.hide();
                }
            }
        });
    },
    destory: function (e) {
        $(this.canvas).off('mousemove');
    },
    show: function (e, data) {
        var canvas = e.target,
            boundingRect = canvas.getBoundingClientRect();
        this.tipLayer.css({top: boundingRect.top + data.y, left: boundingRect.left + data.x}).html('<p>' + data.name + '</p><p>' + data.formatVal + '</p>').show();
    },
    hide: function () {
        this.tipLayer.hide();
    },
    getRelativePosition: function(e) {
        var mouseX, mouseY,
            canvas = e.target,
            boundingRect = canvas.getBoundingClientRect();
        if(e.touches) {
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
    // 获取坐标系坐标
    getCoord: function (x, y) {
         return {
            x: x - this.conf.width / 2,
            y: this.conf.height / 2 - y
        }
    },
    // 获取鼠标所在区域
    getAreaData: function (e) {
        var mouse = this.getRelativePosition(e);
        var co = this.getCoord(mouse.x, mouse.y);
        var r = Math.sqrt(co.x * co.x + co.y * co.y);
        var conf = this.conf;
        var arcAngle = this.getArcAngle(co);
        // 在圆内
        if (r < conf.series.radius) {
            for (var i = 0, _len = conf.drawData.length; i < _len; i++) {
                if (arcAngle >= conf.drawData[i].startAngle && arcAngle <= conf.drawData[i].endAngle) {
                    return $.extend({}, conf.drawData[i], mouse);
                }
            }
        }
        return false;
    },
    // 获取弧度
    getArcAngle: function (co) {
        var r = Math.sqrt(co.x * co.x + co.y * co.y);
        var arcAngle =  Math.asin(co.y / r);
        switch(true) {
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
}