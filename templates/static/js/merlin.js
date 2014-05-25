var items       = 10;
var refreshRate = 1000;
var histLastDat;
var t;
$(document).ready(function(){
    // Wait untill the document is ready for manipulation.

    // Register buttons.
    $("#optionSave").click(optionSave);
    $("#shutdown").click(shutdown);
    $("#restart").click(restart);

    // Refresh periodicly.
    t = window.setInterval(refresh, refreshRate);

    // Functions
    function optionSave(){
        $("#options").modal("hide"); // Hide the modal box
    }
    function refresh(){
        fetchHistory();
        fetchQueue();
        fetchStatus();
    }
    function fetchStatus(){
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

                $("#historyList").html("");
                // Fill history list.
                $.each(data.history.slots, function(index){
                    var date = new Date(this.completed * 1000);
                    var html = "\
                    <li class='list-group-item historyListItem' id='history-"+index+"'>\
                        <div class='row'>\
                            <div class='col-xs-11'>\
                                <p class='list-group-item-text'>"+this.nzb_name+" &mdash; Completed on "+date.getDate()+"-"+date.getMonth()+"-"+date.getFullYear()+".</p>\
                            </div>\
                            <div class='col-xs-1'>\
                                <a href='#' class='list-group-item-text deleteButton' id=''>Delete</a>\
                            </div>\
                        </div>\
                    </li>";
                    $('#historyList').append(html);
                });
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
            // Fill history list.
            $.each(data.queue.slots, function(index){
                var date = new Date(this.completed * 1000);
                var html = "\
                   <li class='list-group-item queueListItem' id='queue-"+index+"'>\
                        <div class='row'>\
                            <div class='col-xs-11'>\
                                <p class='list-group-item-text'>"+this.nzb_name+" &mdash; Completed on "+date.getDate()+"-"+date.getMonth()+"-"+date.getFullYear()+".</p>\
                            </div>\
                            <div class='col-xs-1'>\
                                <a href='#' class='list-group-item-text deleteButton' id=''>Delete</a>\
                            </div>\
                        </div>\
                    </li>";
                $('#historyList').append(html);
            });
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
        // Restart SABnzbd.

        // Ask if sure.
        if (!confirm("Are you sure you want to shutdown?"))
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
});