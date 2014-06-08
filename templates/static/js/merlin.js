// Default settings.
var items       = 10;    // Number of item(s) to fetch.
var refreshRate = 1000;  // Refresh Rate in ms.
var showGraph   = true;  // Show speed graph [true/false].
var speedlim    = false; // Speedlimit [value or false for no speedlimit.]
var speed;               // Current speed.
var _t;                  // Interval variable.
var _gt;                 // Interval variable graph.
var speedChart;          // Speed Graph variable.
var fspeed;              // Formatted speed [KB/s or MB/s]
var warnings = [];       // List of warnings.
var series;

// Misc functions //
function tapiXhr(endpoint, options){
    // Send a request to the template api of SABnzbd+ with options.
    var xhr = $.ajax({
        url: 'tapi',
        type: 'GET',
        cache: false,
        data: $.extend({
            mode: endpoint,
            output: 'json',
            apikey: apiKey
        }, options)
    });
    return xhr;
}
function formatSpeed(sp){
    // Return a nice formated speed.
    if (sp >= 1000){
        return Math.round(sp / 1000 * 100) / 100 + " MB/s"; // Return x.xx MB/s
    } else {
        return Math.round(sp * 100) / 100 + "KB/s" // Return x.xx KB/s
    }
}
function loadLocalStorage(){
    // Load settings from localstorage.
    if(localStorage.getItem('items'))
        items = localStorage.getItem('items');
    if(localStorage.getItem('refreshRate'))
        refreshRate = localStorage.getItem('refreshRate');
    if(localStorage.getItem('showGraph'))
        showGraph = localStorage.getItem('showGraph');
    if(localStorage.getItem('speedlim'))
        speedlim = localStorage.getItem('speedlim');
}
function writeLocalStorage(){
    // Write settings to localstorage.
    localStorage.setItem('items', items);
    localStorage.setItem('refreshRate', refreshRate);
    localStorage.setItem('showGraph', showGraph);
    localStorage.setItem('speedlim', speedlim);
}
function graphAddPoint(){
    var x = (new Date()).getTime(), y = speed;
    series.addPoint([x, y], true, true);
}
function speedGraph(){
    var chart;
    $('#speedGraph').highcharts({
        chart: {
            type: 'spline',
            animation: Highcharts.svg, // don't animate in old IE
            marginRight: 10,
            events: {load: function() {
                    series = this.series[0];
                    _gt = setInterval(graphAddPoint, refreshRate);
        }}},
        title: {text: 'Speed'},
        xAxis: {type: 'datetime',tickPixelInterval: 100},
        yAxis: {title: {text: 'Speed (KB/s)'},plotLines: [{value: 0,width: 1,color: '#808080'}],min: 0},
        tooltip: {enabled: false},
        legend: {enabled: false},
        exporting: {enabled: false},
        plotOptions: {spline: {marker: {enabled: false}}},
        series: [{name: 'Speed Data',data: (function() {
                var data = [],time = (new Date()).getTime(),i;
                for (i = -50; i <= 0; i++) {data.push({x: time + i * 1000,y: 0});}
                return data;
            })()
        }],
    });
}
// Data templates //
function queueItem(nzo_id, name, progress){
    var self      = this;
    self.nzo_id   = nzo_id;
    self.name     = name;
    self.progress = progress;
}
function historyItem(nzo_id, name, status, storage, downloaded, postTime){
    var self        = this;
    self.nzo_id     = nzo_id;
    self.name       = name;
    self.status     = status;
    self.storage    = storage;
    self.downloaded = downloaded;
    self.postTime   = postTime;
}
function statusItem(type, message, time){
    var self     = this;
    self.type    = type;
    self.message = message;
    self.time    = time;
}
function serverItem(status, server, connections){
    var self   = this;
    self.color = status;
    self.host  = server;
    self.connections = connections;
}

// Models //
var miscModel = function (){
    var self        = this;
    self.pause      = ko.observable('Pause');
    self.queueLead  = ko.observable('Queue');
    self.shutdown   = function (){
        if (!confirm("Are you sure you want to shutdown?"))
            return;
        tapiXhr('shutdown'); // Sent shutdown call.
    }
    self.restart    = function (){
        if (!confirm("Are you sure you want to restart?"))
            return;
        tapiXhr('restart'); // Sent restart call.
    }
    self.pauseClick = function (place, e){
        tapiXhr($(e.target).attr('class').toLowerCase());
    }
    self.refresh    = function (options){
        var ajaxCall = tapiXhr('queue', { start: 0, limit: items });
        $.when(ajaxCall).then(function (data){
            // Paused
            if (data.queue.paused == true){
                self.pause('Resume');
            } else {
                self.pause('Pause');
            }

            // Speed
            speed = parseFloat(data.queue.kbpersec); // Set speed in [KB/s] for graph.
            fspeed = formatSpeed(data.queue.kbpersec); // Formated speed x [KB/s or MB/s]
            if (speed == 0){
                window.document.title = "SABnzbd"; // Set window title without speed.
            } else {
                window.document.title = "SABnzbd - "+fspeed; // Set window title with (formatted) current speed.
            }

            // Time Left
            var timeLeft = data.queue.timeleft;
            if(timeLeft !== "0:00:00"){
                self.queueLead("Queue (~"+timeLeft+" @ "+fspeed+")");
            } else {
                self.queueLead("Queue");
            }
        });
    }       
}
var serverModel = function (){
    var self = this;
    self.item = ko.observableArray();
    self.last;
    self.refresh = function (options){
        var ajaxCall = $.ajax({ url: 'status/', type: 'GET', cache: false });
        $.when(ajaxCall).then(function (data){
            // Check if new data.
            if (self.last !== data){
                self.last = data;
                self.item.removeAll();
                dat = $.parseJSON(data);
                $.each(dat.servers, function (index){
                    var status = parseInt(this.status);
                    var color;
                    if (status == 1){
                        color = 'green';
                    } else if (status == 2){
                        color = 'gray';
                    } else if (status == 3){
                        color = 'gray';
                    }
                    self.item.push(new serverItem(color, this.server, this.connections));
                });
            }
        });
    }
}
var statusModel = function (){
    var self  = this;
    self.item = ko.observableArray();
    self.last = 0; // Last status.
    self.clear = function (place, e){
        if(!confirm("Are you sure you want to clear the status log?"))
            return;
        $.ajax({
            url: 'status/clearwarnings',
            type: 'GET',
            cache: false,
            data: {
                session: apiKey
            }
        });
    }
    self.refresh = function (options){
        var ajaxCall = tapiXhr('warnings');
        $.when(ajaxCall).then(function (data){
            if(!data.warnings[0])
                // No data, quit.
                return;
            __temp_last = data.warnings[0].split("\n")[0]
            if(__temp_last !== self.last){
                self.last = __temp_last;
                self.item.removeAll();
                $.each(data.warnings, function (index){
                    data = this.split("\n");
                    self.item.push(new statusItem(data[1], data[2], data[0].split(",")[0]));
                });
                self.item.reverse();
            }
        });
    }
}
var queueModel = function (){
    var self     = this;
    self.item    = ko.observableArray();
    self.delete  = function (place, e){
        var nzo_id = $(e.target).parent().parent().parent().children("#nzo_id").attr('value');
        tapiXhr('queue', { name: 'delete', value: nzo_id });
        //self.item.remove(place);
    }
    self.clear = function (place, e){
        if(!confirm("Are you sure you want to clear the queue?"))
            return;
        tapiXhr('queue', { name: 'delete', value: 'all'});
    }
    self.refresh = function (options){
        var ajaxCall = tapiXhr('queue', { start: 0, limit: items });
        $.when(ajaxCall).then(function (data){
            self.item.removeAll(); // Clear prev. queue.
            $.each(data.queue.slots, function (index){
                self.progress = (Math.round((this.mb - this.mbleft) / this.mb * 100 * 100) / 100); // Progress in percent to two decimal places.
                self.item.push(new queueItem(this.nzo_id, this.filename, String(self.progress)));
            });
        });
    }
}
var historyModel = function (){
    var self = this;
    self.item = ko.observableArray();
    self.last;
    self.clear = function (place, e){
        if(!confirm("Are you sure you want to clear the history?"))
            return;
        tapiXhr('history', { name: 'delete', value: 'all'});
    }
    self.info    = function (place, e){
        if ($(e.target).parent().parent().parent().children(".info").css('display') == 'none'){
            $(e.target).parent().parent().parent().children(".info").slideToggle();
        } else {
            $(".historyListItem > .info").slideUp();
        }
    }
    self.delete  = function (place){
        var nzo_id = $(e.target).parent().parent().parent().children("#nzo_id").attr('value');
        tapiXhr('history', { name: 'delete', value: nzo_id });
    }
    self.refresh = function (options){
        var ajaxCall = tapiXhr('history', { start: 0, limit: items });
        $.when(ajaxCall).then(function (data){
            // Check if newer info.
            if (data.history.slots[0] && self.last !== data.history.slots[0].toString()){
                self.last = data.history.slots[0].toString();
                self.item.removeAll();
                $.each(data.history.slots, function (index){
                    self.date = new Date(this.completed * 1000);
                    self.item.push(new historyItem(this.nzo_id, this.name, this.status, this.storage, this.downloaded, this.postproc_time));
                });
            }
        });
    }
}

// Main function //
var main = function (){
    var self     = this;

    // Load vars from localstorage
    loadLocalStorage();

    // Set models.
    self.hist    = new historyModel(); // for some reason self.history.refresh() doesn't work so use self.hist.
    self.queue   = new queueModel();
    self.stat    = new statusModel();
    self.servers = new serverModel();
    self.misc    = new miscModel();
    self.refresh = function (){
        self.misc.refresh();
        self.hist.refresh();
        self.queue.refresh();
        self.stat.refresh();
        self.servers.refresh();
    }
    self.displayWarnings = function (){
        if(warnings){}
    }
    self.saveOption = function (){
        var __refreshRate = $("#refreshRate").attr('value');
        var __items       = $("#itemLimit").attr('value');
        var __speedlim    = $("#speedLimit").attr('value');
        if (__refreshRate) {
            refreshRate = parseInt(__refreshRate) * 1000;
            window.clearInterval(_t);
            window.clearInterval(_gt);
            _t  = window.setInterval(self.refresh, refreshRate);
            _gt = window.setInterval(graphAddPoint, refreshRate);
        } else {
            // Default.
            refreshRate = 1000;
            window.clearInterval(_t);
            window.clearInterval(_gt);
            _t  = window.setInterval(self.refresh, refreshRate);
            _gt = window.setInterval(graphAddPoint, refreshRate);
        }
        if(__items) {
            items = parseInt(__items);
        } else {
            // Default.
            items = 10;
        }
        if(__speedlim) {
            speedlim = parseInt(speedlim);
            tapiXhr('config', {name: 'speedlimit', value: speedlim}); // Set speed lim.
        } else {
            tapiXhr('config', {name: 'speedlimit', value: 0}); // Reset speed lim.
        }
        $("#options").modal('hide');
    }

    // Periodically refresh.
    _t = window.setInterval(self.refresh, refreshRate);

    // Init
    self.refresh(); // Refresh once.
}
$(document).ready(function(){
    // Wait untill the document is ready for manipulation.
    ko.applyBindings(main);
    speedGraph();
    Highcharts.setOptions({global: {useUTC: false}});
});
