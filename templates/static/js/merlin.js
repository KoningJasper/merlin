var items       = 10;   // Number of item(s) to fetch.
var refreshRate = 1000; // Refresh Rate in ms.
var showGraph   = true; // Show speed graph [true/false].
var paused      = false;// Is SABnzbd paused.
var speed;              // Current speed.
var histLastDat;        // Date of last item added to history.
var graphTime;          // Time at begining of graph.
var t;                  // Interval variable.
var speedChart;         // Speed Graph variable.
var fspeed;             // Formatted speed [KB/s or MB/s]


$(document).ready(function(){
    // Wait untill the document is ready for manipulation.

    // Init
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

    // Refresh periodicly.
    t = window.setInterval(refresh, refreshRate);

    // Functions
    function infoBtn(){
        $(this).parent().parent().parent().children(".info").slideToggle();
    }
    function clear(what){
        if(!confirm("Are you sure you want to clear the "+what+"?"))
            return;
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
        refreshMenuStatus();
    }
    function fetchWarnings(){
        var ajaxCall = $.ajax({
            url: 'tapi',
            type: 'GET',
            cache: false,
            data: {
                mode: 'warnings',
                output: 'json',
                apikey: apiKey
            }
        })
        $.when(ajaxCall).then(function(data){
            $.each(data.warnings, function(index){
                $("#statusList").html("");
                var html = "\
                    <li class='list-group-item historyListItem' id='history-"+index+"'>\
                        <div class='row'>\
                            <div class='col-xs-12'>\
                                <p class='list-group-item-text'>"+this+"</p>\
                            </div>\
                        </div>\
                    </li>";
                $("#statusList").append(html);
            });
        });
    }
    function formatSpeed(sp){
        if (sp >= 1000){
            return Math.round(sp / 1000 * 100) / 100 + " MB/s"; // Return x.xx MB/s
        } else {
            return Math.round(sp * 100) / 100 + "KB/s" // Return x.xx KB/s
        }
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
    function fetchHistory(){
        // Send request for History data to SABnzbd.
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
        $.when(ajaxCall).then(function(data){
            // Check if data already exists.
            if (histLastDat !== data.history.slots[0].completed) {
                histLastDat = data.history.slots[0].completed; // Set new newest data time.
                var html    = [];                              // Create empty html array.

                // Fill history list.
                $.each(data.history.slots, function(index){
                    var date = new Date(this.completed * 1000);
                    html.push("\
                    <li class='list-group-item historyListItem' id='history-"+index+"'>\
                        <div class='row'>\
                            <div class='col-xs-10'>\
                                <p class='list-group-item-text'>"+this.nzb_name+" &mdash; Completed on "+date.getDate()+"-"+date.getMonth()+"-"+date.getFullYear()+".</p>\
                            </div>\
                            <div class='col-xs-2 deleteButton'>\
                                <button class='btn btn-info btn-xs infoBtn'>Info</button>\
                                <button class='btn btn-danger btn-xs' id='deleteBtn'>Delete</button>\
                            </div>\
                        </div>\
                        <div class='row info' style='display: none;'>\
                            <div class='col-xs-11'>\
                                <div class='row'>\
                                    <div class='col-xs-2'><span>Status:</span></div>\
                                    <div class='col-xs-9'><span>"+this.status+"</span></div>\
                                </div>\
                                <div class='row'>\
                                    <div class='col-xs-2'><span>Location:</span></div>\
                                    <div class='col-xs-9'><span>"+this.storage+"</span></div>\
                                </div>\
                                <div class='row'>\
                                    <div class='col-xs-2'><span>Downloaded:</span></div>\
                                    <div class='col-xs-9'><span>"+Math.round(this.downloaded / 1024 / 1024 / 1024 * 100) / 100 +" GB</span></div>\
                                </div>\
                                <div class='row'>\
                                    <div class='col-xs-2'><span>Post:</span></div>\
                                    <div class='col-xs-9'><span>"+this.postproc_time+" seconds.</span></div>\
                                </div>\
                            </div>\
                        </div>\
                    </li>");
                });

                // Output
                $('#historyList').html(html);

                // Register buttons
                $('.infoBtn').click(infoBtn); 
                $('.deleteBtn').click(deleteBtn);
            }
        });
    }
    function fetchQueue(){
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
        $.when(ajaxCall).then(function(data){
            // Pause
            paused = data.queue.paused;

            // Speed
            speed  = parseFloat(data.queue.kbpersec); // Set speed in [KB/s]
            fspeed = formatSpeed(data.queue.kbpersec); // Formated speed x [KB/s or MB/s]
            if (speed == 0){
                window.document.title = "SABnzbd"; // Set title without speed.
            } else {
                window.document.title = "SABnzbd - "+fspeed; // Set title with (formatted) current speed.
            }

            // Time Left
            var timeLeft = data.queue.timeleft;
            if(timeLeft !== "0:00:00"){
                $("#queueLead").text("Queue (~"+timeLeft+" @ "+fspeed+")");
            } else {
                $("#queueLead").text("Queue");
            }

            $('#queueList').html(""); // Clear old queue list.
            // Fill Queue list.
            var html = [];
            $.each(data.queue.slots, function(index){
                var progress = Math.round((this.mb - this.mbleft) / this.mb * 100 * 100) / 100; // Progress in percent to two decimal places.
                html.push("\
                   <li class='list-group-item queueListItem' id='queue-"+index+"'>\
                        <div class='row'>\
                            <div class='col-xs-11'>\
                                <p class='list-group-item-text'>"+this.filename+"</p>\
                            </div>\
                            <div class='col-xs-1 deleteButton'>\
                                <button class='btn btn-danger btn-xs'>Delete</button>\
                            </div>\
                        </div>\
                        <div class='rowSpacer'></div>\
                        <div class='row'>\
                            <div class='col-xs-12'>\
                                <div class='progress'>\
                                    <div class='progress-bar' role='progressbar' aria-valuenow='"+progress+"' aria-valuemin='0' aria-valuemax='100' style='width: "+progress+"%'>"+progress+"%</div></div>\
                                </div>\
                            </div>\
                        </div>\
                    </li>");
                
            });
            $('#queueList').html(html); // Output
        });
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