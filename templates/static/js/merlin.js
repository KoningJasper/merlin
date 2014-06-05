var items       = 10;    // Number of item(s) to fetch.
var refreshRate = 1000;  // Refresh Rate in ms.
var showGraph   = true;  // Show speed graph [true/false].
var paused      = false; // Is SABnzbd paused.
var speed;               // Current speed.
var t;                   // Interval variable.
var speedChart;          // Speed Graph variable.
var fspeed;              // Formatted speed [KB/s or MB/s]

// Data templates //
function queueItem(name, progress){
    var self = this;
    self.name = name;
    self.progress = progress;
}
function historyItem(name, status, storage, downloaded, postTime){
    var self = this;
    self.name = name;
    self.status = status;
    self.storage = storage;
    self.downloaded = downloaded;
    self.postTime = postTime;
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
var serverModel = function (){
    var self = this;
    self.item = ko.observableArray();
    self.last;
    self.refresh = function (options){
        var ajaxCall = $.ajax({
            url: 'status/',
            type: 'GET',
            cache: false
        });
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
    self.refresh = function (options){
        var ajaxCall = $.ajax({
            url: 'tapi',
            type: 'GET',
            cache: false,
            data: {
                mode: 'warnings',
                output: 'json',
                apikey: apiKey
            }
        });
        $.when(ajaxCall).then(function (data){
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
    var self = this;
    self.item = ko.observableArray();
    self.refresh = function (options){
        var ajaxCall = $.ajax({
            url: 'tapi',
            type: 'GET',
            cache: false,
            data: {
                mode: 'queue',
                start: 0,
                limit: items,
                output: 'json',
                apikey: apiKey
            }
        });
        $.when(ajaxCall).then(function (data){
            // Paused?
            paused = data.queue.paused;

            // Speed
            speed = parseFloat(data.queue.kbpersec); // Set speed in [KB/s]
            fspeed = formatSpeed(data.queue.kbpersec); // Formated speed x [KB/s or MB/s]
            if (speed == 0){
                window.document.title = "SABnzbd"; // Set window title without speed.
            } else {
                window.document.title = "SABnzbd - "+fspeed; // Set window title with (formatted) current speed.
            }

            // Time Left
            var timeLeft = data.queue.timeleft;
            if(timeLeft !== "0:00:00"){
                $("#queueLead").text("Queue (~"+timeLeft+" @ "+fspeed+")");
            } else {
                $("#queueLead").text("Queue");
            }

            self.item.removeAll(); // Clear prev. queue.
            $.each(data.queue.slots, function (index){
                self.progress = (Math.round((this.mb - this.mbleft) / this.mb * 100 * 100) / 100); // Progress in percent to two decimal places.
                self.item.push(new queueItem(this.filename, String(self.progress)));
            });
        });
    }
}
var historyModel = function (){
    var self = this;
    self.item = ko.observableArray();
    self.last;
    self.refresh = function (options){
        var ajaxCall = $.ajax({
            url: 'tapi',
            type: 'GET',
            cache: false,
            data: {
                mode: 'history',
                start: 0,
                limit: items,
                output: 'json',
                apikey: apiKey
            }
        });
        $.when(ajaxCall).then(function (data){

            // Check if newer info.
            if (self.last !== data.history.slots[0]){
                self.item.removeAll();
                $.each(data.history.slots, function (index){
                    self.date = new Date(this.completed * 1000);
                    self.item.push(new historyItem(this.name, this.status, this.storage, this.downloaded, this.postproc_time));
                });
            }
        });
    }
}

// Main function //
var main = function (){
    var self     = this;
    self.hist    = new historyModel(); // for someway self.history.refresh() doesn't work so use self.hist.
    self.queue   = new queueModel();
    self.stat    = new statusModel();
    self.servers = new serverModel();
    self.refresh = function (){
        self.hist.refresh();
        self.queue.refresh();
        self.stat.refresh();
        self.servers.refresh();
    }
    var _xt = window.setInterval(self.refresh, refreshRate);

    // Init
    self.refresh(); // Refresh once.
}

// Misc functions //
function formatSpeed(sp){
    if (sp >= 1000){
        return Math.round(sp / 1000 * 100) / 100 + " MB/s"; // Return x.xx MB/s
    } else {
        return Math.round(sp * 100) / 100 + "KB/s" // Return x.xx KB/s
    }
}
$(document).ready(function(){
    // Wait untill the document is ready for manipulation.

    // Init
    ko.applyBindings(main);
    refresh();
    speedGraph();
    Highcharts.setOptions({
        global: {
            useUTC: false
        }
    });

    // Register buttons.
    $("#optionSave").click(optionSave);
    $("#shutdown").click(shutdown);
    $("#restart").click(restart);
    $("#menuStatus").click(menuStatusClick);
    $("#infoBtn").click(infoBtn);
    $(".clearBtn").click(clear);

    // Refresh periodicly.
    t = window.setInterval(refresh, refreshRate);

    // Functions
    function optionSave(){
        // Save options and do somethings with it.
    }
    function infoBtn(){
        if ($(this).parent().parent().parent().children(".info").css('display') == 'none'){
            $(this).parent().parent().parent().children(".info").slideToggle();
        } else {
            $(".historyListItem > .info").slideUp();
        }
    }
    function clear(){
        var what = $(this).attr('data');
        if(!confirm("Are you sure you want to clear the "+what+"?"))
            return;
        $.ajax({
            url: 'tapi',
            type: 'GET',
            cache: false,
            data: {
                mode: what,
                name: 'delete',
                value: 'all',
                apikey: apiKey
            }
        });
        refresh();
    }
    function menuStatusClick(){
        var action = $("#menuStatus").attr('data');
        if(action == "pause"){
            $.ajax({
                url: 'tapi',
                type: 'GET',
                cache: false,
                data: {
                    mode: 'pause',
                    output: 'json',
                    apikey: apiKey
                }
            });
            paused = true;
            $("#menuStatus").text('Resume');
            $('#menuStatus').attr('data', 'resume');
        } else if(action == "resume"){
            $.ajax({
                url: 'tapi',
                type: 'GET',
                cache: false,
                data: {
                    mode: 'resume',
                    output: 'json',
                    apikey: apiKey
                }
            });
            paused = false;
            $("#menuStatus").text('Pause');
            $('#menuStatus').attr('data', 'pause');
        }
    }
    function refreshMenuStatus(){
        if (paused == true){
            $("#menuStatus").text('Resume');
            $('#menuStatus').attr('data', 'resume');
        } else if(paused == false){
            $("#menuStatus").text('Pause');
            $('#menuStatus').attr('data', 'pause');
        }
    }
    function optionSave(){
        $("#options").modal("hide"); // Hide the modal box
    }
    function refresh(){
        // Refresh everything.
        fetchHistory();
        fetchQueue();
        fetchWarnings();
        fetchServerStatus();
        refreshMenuStatus();
    }
    function fetchWarnings(){
    }
    
    function speedGraph(){
        if(showGraph == true){
            // Graph is true.
            var chart;
            $('#speedGraph').highcharts({
                chart: {
                    type: 'spline',
                    animation: Highcharts.svg, // don't animate in old IE
                    marginRight: 10,
                    events: {
                        load: function() {
                            // set up the updating of the chart each second
                            var series = this.series[0];
                            setInterval(function() {
                                var x = (new Date()).getTime(), // current time
                                    y = speed;
                                series.addPoint([x, y], true, true);
                            }, refreshRate);
                        }
                    }
                },
                title: {
                    text: 'Speed'
                },
                xAxis: {
                    type: 'datetime',
                    tickPixelInterval: 100
                },
                yAxis: {
                    title: {
                        text: 'Speed (KB/s)'
                    },
                    plotLines: [{
                        value: 0,
                        width: 1,
                        color: '#808080'
                    }],
                    min: 0
                },
                tooltip: {
                    enabled: false
                },
                legend: {
                    enabled: false
                },
                exporting: {
                    enabled: false
                },
                plotOptions: {
                    spline: {
                        marker: {
                            enabled: false
                        }
                    }
                },
                series: [{
                    name: 'Random data',
                    data: (function() {
                        // generate an array of random data
                        var data = [],
                            time = (new Date()).getTime(),
                            i;

                        for (i = -50; i <= 0; i++) {
                            data.push({
                                x: time + i * 1000,
                                y: 0
                            });
                        }
                        return data;
                    })()
                }],
            });
        }
    }
    function fetchServerStatus(){
    }
    function fetchHistory(){
    }
    function fetchQueue(){
    }
    function restart(){
        // Restart SABnzbd.

        // Ask if sure.
        if (!confirm("Are you sure you want to restart?"))
            return;

        // Sent restart call.
        $.ajax({
            url: 'tapi',
            type: 'GET',
            cache: false,
            data: {
                mode: 'restart',
                output: 'json',
                apikey: apiKey
            }
        });
    }
    function shutdown(){
        // Shutdown SABnzbd.

        // Ask if sure.
        if (!confirm("Are you sure you want to shutdown?"))
            return;

        // Sent restart call.
        $.ajax({
            url: 'tapi',
            type: 'GET',
            cache: false,
            data: {
                mode: 'shutdown',
                output: 'json',
                apikey: apiKey
            }
        });
    }
});
