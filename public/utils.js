'use strict';
window.jira_color = {
    issuetypes: [
        { name: 'red', code: 'rgb(255, 99, 132)'},
        { name: 'orange', code: 'rgb(255, 159, 64)'},
        { name: 'yellow', code: 'rgb(255, 205, 86)'},
        { name: 'green', code: 'rgb(75, 192, 192)'},
        { name: 'blue', code: 'rgb(54, 162, 235)'},
        { name: 'purple', code: 'rgb(153, 102, 255)'},
        { name: 'grey', code: 'rgb(201, 203, 207)'}
    ],
    users: {
        'nguyen.tran': 'rgb(255, 99, 132)',
        'vi.phantt': 'rgb(255, 159, 64)',
        'hoang.dinh': 'rgb(255, 205, 86)',
        'dat.huynh': 'rgb(75, 192, 192)',
        'dong.nguyen': 'rgb(54, 162, 235)',
        'nghia.huynht': 'rgb(153, 102, 255)',
        'dat.pham': 'rgb(201, 203, 207)',
        'thuan.le': 'rgb(73, 48, 48)',
        'hao.le': 'rgb(92, 96, 68)',
        'nhuan.vu': 'rgb(101, 112, 38)',
        'trinh.nguyent': 'rgb(7, 7, 4)',
        'quynh.hoang': 'rgb(242, 109, 53)',
        'thanh.nguyen': 'rgb(171, 252, 237)',
        'anh.bui': 'rgb(138, 79, 125)',
        'dung.nguyen': 'rgb(0, 187, 239)',
        'tuan.nguyena': 'rgb(101, 72, 112)',
        'hao.lek': 'rgb(130, 24, 48)',
        'an.nguyenp': 'rgb(247, 161, 90)',
        'hien.do': 'rgb(193, 106, 78)',
        'phuong.tran': 'rgb(96, 146, 125)',
        'vinh.tran': 'rgb(141, 143, 183)',
        'chuong.nguyen': 'rgb(249, 149, 198)',
        'duy.nguyen': 'rgb(17, 39, 11)',
        'nhan.phan': 'rgb(65, 140, 44)',
        'vi.leh': 'rgb(73, 35, 35)',
        'thuan.ho': 'rgb(52, 61, 36)',
        'hoang.nguyen': 'rgb(40, 63, 56)',
        'chuong.vo': 'rgb(10, 36, 99)',
        'nhan.nguyentt': 'rgb(226, 201, 127)',
        'hai.ta': 'rgb(86, 71, 27)'
    }
};
window.chartColors = {
	red: 'rgb(255, 99, 132)',
	orange: 'rgb(255, 159, 64)',
	yellow: 'rgb(255, 205, 86)',
	green: 'rgb(75, 192, 192)',
	blue: 'rgb(54, 162, 235)',
	purple: 'rgb(153, 102, 255)',
	grey: 'rgb(201, 203, 207)'
};

(function(global) {
	var Months = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];

	var COLORS = [
		'#4dc9f6',
		'#f67019',
		'#f53794',
		'#537bc4',
		'#acc236',
		'#166a8f',
		'#00a950',
		'#58595b',
		'#8549ba'
	];

	var Samples = global.Samples || (global.Samples = {});
	var Color = global.Color;

	Samples.utils = {
		// Adapted from http://indiegamr.com/generate-repeatable-random-numbers-in-js/
		srand: function(seed) {
			this._seed = seed;
		},

		rand: function(min, max) {
			var seed = this._seed;
			min = min === undefined ? 0 : min;
			max = max === undefined ? 1 : max;
			this._seed = (seed * 9301 + 49297) % 233280;
			return min + (this._seed / 233280) * (max - min);
		},

		numbers: function(config) {
			var cfg = config || {};
			var min = cfg.min || 0;
			var max = cfg.max || 1;
			var from = cfg.from || [];
			var count = cfg.count || 8;
			var decimals = cfg.decimals || 8;
			var continuity = cfg.continuity || 1;
			var dfactor = Math.pow(10, decimals) || 0;
			var data = [];
			var i, value;

			for (i = 0; i < count; ++i) {
				value = (from[i] || 0) + this.rand(min, max);
				if (this.rand() <= continuity) {
					data.push(Math.round(dfactor * value) / dfactor);
				} else {
					data.push(null);
				}
			}

			return data;
		},

		labels: function(config) {
			var cfg = config || {};
			var min = cfg.min || 0;
			var max = cfg.max || 100;
			var count = cfg.count || 8;
			var step = (max - min) / count;
			var decimals = cfg.decimals || 8;
			var dfactor = Math.pow(10, decimals) || 0;
			var prefix = cfg.prefix || '';
			var values = [];
			var i;

			for (i = min; i < max; i += step) {
				values.push(prefix + Math.round(dfactor * i) / dfactor);
			}

			return values;
		},

		months: function(config) {
			var cfg = config || {};
			var count = cfg.count || 12;
			var section = cfg.section;
			var values = [];
			var i, value;

			for (i = 0; i < count; ++i) {
				value = Months[Math.ceil(i) % 12];
				values.push(value.substring(0, section));
			}

			return values;
		},

		color: function(index) {
			return COLORS[index % COLORS.length];
		},

		transparentize: function(color, opacity) {
			var alpha = opacity === undefined ? 0.5 : 1 - opacity;
			return Color(color).alpha(alpha).rgbString();
		}
	};

	// DEPRECATED
	window.randomScalingFactor = function() {
		return Math.round(Samples.utils.rand(-100, 100));
	};

	// INITIALIZATION

	Samples.utils.srand(Date.now());

	// Google Analytics
	/* eslint-disable */
	if (document.location.hostname.match(/^(www\.)?chartjs\.org$/)) {
		(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
		(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
		m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
		})(window,document,'script','//www.google-analytics.com/analytics.js','ga');
		ga('create', 'UA-28909194-3', 'auto');
		ga('send', 'pageview');
	}
	/* eslint-enable */

}(this));
