/*** HomelyAlarm Z-Way HA module *******************************************

Version: 1.0.0
(c) Maroš Kollár, 2015
-----------------------------------------------------------------------------
Author: Maroš Kollár <maros@k-1.com>
Description:
    This module allows to send alarm notifications via HomelyAlarm
    server https://github.com/maros/HomelyAlarm

******************************************************************************/

function HomelyAlarm (id, controller) {
    // Call superconstructor first (AutomationModule)
    HomelyAlarm.super_.call(this, id, controller);
    
    this.eventHandlers = {};
}

inherits(HomelyAlarm, AutomationModule);

_module = HomelyAlarm;

// ----------------------------------------------------------------------------
// --- Module instance initialized
// ----------------------------------------------------------------------------

HomelyAlarm.prototype.init = function (config) {
    HomelyAlarm.super_.prototype.init.call(this, config);
    
    var self = this;
    
    self.eventHandlers = {};
    _.each(self.config.events,function(element,index) {
        _.each(self.listenEvents,function(handlerName,event){
            var handler = _.bind(self[handlerName],self,element);
            self.controller.on(element.type+'.'+event,handler);
            self.eventHandlers[index+event] = handler;
        });
    });
    
    executeFile("modules/HomelyAlarm/sha1.js");
};

HomelyAlarm.prototype.stop = function () {
    var self = this;
    
    _.each(self.config.events,function(element,index) {
        _.each(self.listenEvents,function(event,handlerName){
            self.controller.odd(element.type+'.'+event,self.eventHandlers[index+event]);
        });
    });
    self.eventHandlers = {};
    
    HomelyAlarm.super_.prototype.stop.call(this);
};

// ----------------------------------------------------------------------------
// --- Module methods
// ----------------------------------------------------------------------------

HomelyAlarm.prototype.listenEvents = {
    "alarm":            "handleAlarm",
    "stop":             "handleStop",
    "delayed_alarm":    "handleDelayedAlarm",
    "delayed_cancel":   "handleDelayedCancel",
    "warning":          "handleWarning"
};

HomelyAlarm.prototype.severityActions = [
    "email",
    "sms",
    "voice"
];

HomelyAlarm.prototype.handleAlarm = function (eventConfig,event) {
    var self = this;
    
    console.log('[HomelyAlarm] Got '+eventConfig.type+' alarm event. severity '+eventConfig.severity);
    self.handleEvent('alarm',event,self.getRecipients(eventConfig.severity));
};

HomelyAlarm.prototype.handleStop = function (eventConfig,event) {
    var self = this;
    
    console.log('[HomelyAlarm] Got '+eventConfig.type+' stop event. severity '+eventConfig.severity);
    self.handleEvent('stop',event);
};

HomelyAlarm.prototype.handleDelayedAlarm = function (eventConfig,event) {
    var self = this;
    
    console.log('[HomelyAlarm] Got '+eventConfig.type+' delayed_alarm event. severity '+eventConfig.severity);
    self.handleEvent('delayed',event,self.getRecipients(eventConfig.severity));
};

HomelyAlarm.prototype.handleDelayedCancel = function (eventConfig,event) {
    var self = this;
    
    console.log('[HomelyAlarm] Got '+eventConfig.type+' delayed_cancel event. severity '+eventConfig.severity);
    self.handleEvent('cancel',event);
};

HomelyAlarm.prototype.handleWarning = function (eventConfig,event) {
    var self = this;
    
    console.log('[HomelyAlarm] Got '+eventConfig.type+' warning event.');
    self.handleEvent('warning',event,self.getRecipients(1));
};

HomelyAlarm.prototype.handleEvent = function(action,event,recipients) {
    var self = this;
    
    var params = { id: event.id };
    _.each(['id','message','title','type'],function(key) {
        if (typeof(event[key]) !== 'undefined') {
            params[key] = event[key];
        }
    });
    
    if (typeof(recipients) !== 'undefined') {
        params.recipients = recipients;
    }

    self.remoteCall(action,params);
};

HomelyAlarm.prototype.getRecipients = function(severity) {
    var self = this;
    
    severity = parseInt(severity);
    
    var recipients = [];
    _.each(self.config.recipients,function(recipient) {
        var actions = [];
        var recipientSeverity = parseInt(recipient.severity);
        if (recipientSeverity > severity) {
            return;
        }
        
        if (recipient.telephone) {
            if (recipient.voice) {
                actions[3] = ['voice',recipient.telephone];
            }
            if (recipient.sms) {
                actions[2] = ['sms',recipient.telephone];
            }
        }
        if (recipient.email) {
            actions[1] = ['email',recipient.email];
        }
        
        for(var s = severity; s > 0; s--) {
            if (typeof(actions[s]) !== 'undefined') {
                recipients.push(actions[s]);
                return;
            }
        }
        
        for(var i = 0; i <= severity; i++) {
            if (typeof(actions[i]) !== 'undefined') {
                recipients.push(actions[i]);
                return;
            }
        }
    });
    
    return recipients;
};

HomelyAlarm.prototype.remoteCall = function(action,params) {
    var self = this;
    
    // Build query_string
    params = params || {};
    params.action = action;
    params.time = (new Date()).getTime();
    var queryString = JSON.stringify(params);
    
    // Build URL
    var url = this.server;
    if (!url.match(/\/$/)) {
        url = url + '/';
    }
    url = url + action;
    
    // Build signature
    var sha = new jsSHA(queryString, "TEXT");
    var signature = sha.getHMAC(this.secret, "TEXT", "SHA-512", "HEX");
    
    // HTTP request
    http.request({
        method: 'POST',
        url: url,
        data: queryString,
        headers: {
            "Content−Type": "application/json",
            "X-HomelyAlarm-Signature": signature
        },
        async: true,
        success: function(response) {},
        error: function(response) {
            console.error('[HomelyAlarm] Could not call alarm server');
        }
    });
};