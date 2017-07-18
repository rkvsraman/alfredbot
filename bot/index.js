'use strict';

var AWS = require("aws-sdk");

AWS.config.update({
    region: "us-east-1"
});

/**
 * This is a small bot which is a Google Keep  clone for chatbots on Slack and Facebook. You can create small lists
 * and go through them again and again in a conversational interactive interface. 
 
 */


// --------------- Helpers to build responses which match the structure of the necessary dialog actions -----------------------

function elicitSlot(sessionAttributes, intentName, slots, slotToElicit, message) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitSlot',
            intentName,
            slots,
            slotToElicit,
            message,
        },
    };
}

function elicitSlotWithResponse(sessionAttributes, intentName, slots, slotToElicit, message, responseCard) {
    var returnval = {
        sessionAttributes,
        dialogAction: {
            type: 'ElicitSlot',
            intentName,
            slots,
            slotToElicit,
            message,
            responseCard
        },
    };
    console.log('%j', returnval);
    return returnval;
}

function closeWithResponse(event, store, sessionAttributes, fulfillmentState, message, responseCard) {

    if (store) {
        var docClient = new AWS.DynamoDB.DocumentClient();
        var params = {
            TableName: "AlfredBot",
            Item: {
                "userID": event.userId,
                "info": sessionAttributes.sessionObject
            }
        }
        console.log("Adding a new item...");
        docClient.put(params, function (err, data) {
            if (err) {
                console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));

            } else {
                console.log("Added item:", JSON.stringify(data, null, 2));

            }


        });
    }

    var returnval = {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState: fulfillmentState,
            message: message,
            responseCard: responseCard
        }
    };
    console.log('%j', returnval);
    return returnval;


}

function close(sessionAttributes, fulfillmentState, message) {

    var returnval = {
        sessionAttributes,
        dialogAction: {
            type: 'Close',
            fulfillmentState: fulfillmentState,
            message: message,
        }
    };

    return returnval;
}

function delegate(sessionAttributes, slots) {
    return {
        sessionAttributes,
        dialogAction: {
            type: 'Delegate',
            slots,
        },
    };
}



// --------------- Intents -----------------------



function doAddToList(event, callback) {

    if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
        var sessionObject = JSON.parse(event.sessionAttributes.sessionObject);
        if (sessionObject.currentSession) {
            var currentSession = sessionObject.currentSession;
            if (sessionObject.lists) {

                var found = false;
                sessionObject.lists.forEach(function (element) {
                    if (element.name == currentSession) {
                        found = true;
                        element.listItems.push(event.currentIntent.slots.ListItem);
                    }
                });
                if (!found) {
                    var list = {};
                    list.name = currentSession;
                    list.listItems = [];
                    list.listItems.push(event.currentIntent.slots.ListItem);
                    sessionObject.lists.push(list);
                }
            } else {
                sessionObject.lists = [];
                var list = {};
                list.name = currentSession;
                list.listItems = [];
                list.listItems.push(event.currentIntent.slots.ListItem);
                sessionObject.lists.push(list);

            }
            var sessionAttributes = event.sessionAttributes;
            if (!sessionAttributes)
                sessionAttributes = {};
            sessionAttributes.sessionObject = JSON.stringify(sessionObject);
            console.log('%j', sessionAttributes);
            callback(null, closeWithResponse(event, true, sessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: event.currentIntent.slots.ListItem + " added !!"
            }, {
                contentType: "application/vnd.amazonaws.card.generic",
                genericAttachments: [{
                    title: "Working list:" + sessionObject.currentSession,
                    subTitle: "You could now...",
                    buttons: [{
                        "text": "add more things",
                        "value": "Add a new item to the list"
                    }, {
                        "text": "save the list",
                        "value": "Save the list"
                    }]
                }]
            }));

        } else {
            callback(null, close(event.sessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: "No list selected to add the item to!!"
            }));
        }

    } else {
        callback(null, close(event.sessionAttributes, 'Fulfilled', {
            contentType: 'PlainText',
            content: "No list selected to add the item to!!"
        }));
    }
}

function doCreateList(event, callback) {

    if (event.invocationSource == "DialogCodeHook" && !event.currentIntent.slots.ListName) {

        var buttonsList = [];
        if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
            sessionObject = JSON.parse(event.sessionAttributes.sessionObject);
            console.log('%j', sessionObject);
            var lists = '';
            if (sessionObject.lists) {
                sessionObject.lists.forEach(function (element) {

                    lists += element.name + "\n";
                    var button = {};
                    button.text = element.name;
                    button.value = element.name;
                    buttonsList.push(button);

                });
                callback(null, elicitSlotWithResponse(event.sessionAttributes, event.currentIntent.name, {
                        "ListName": null
                    },
                    "ListName", {
                        contentType: 'PlainText',
                        content: "We have following ...\n"+lists+"\nWhat should the new one be called?\n(One word please)"
                    }, null

                ));


            }


        }
        else{
            callback(null, elicitSlotWithResponse(event.sessionAttributes, event.currentIntent.name, {
                        "ListName": null
                    },
                    "ListName", {
                        contentType: 'PlainText',
                        content: "Yaay... creating the first one, what should it be called (one word please!!)?"
                    }, null

                ));
        }

        return;

    }
    var items_in_list = [];
    var listName = event.currentIntent.slots.ListName.toLowerCase();
    var sessionObject = {};
    if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
        sessionObject = JSON.parse(event.sessionAttributes.sessionObject);
    }
    if (sessionObject.lists) {

        var found = false;
        sessionObject.lists.forEach(function (element) {
            if (element.name == listName) {
                found = true;
                items_in_list = element.listItems;
                sessionObject.currentIndex = 0;
            }
        });
        console.log(found);
        if (found) {
            sessionObject.currentSession = listName;
        } else {
            var list = {};
            list.name = listName;
            sessionObject.currentSession = listName;
            list.listItems = [];
            sessionObject.lists.push(list);
        }



    } else {
        sessionObject.lists = [];
        var list = {};
        list.name = listName;
        sessionObject.currentSession = listName;
        list.listItems = [];
        sessionObject.lists.push(list);

    }
    var sessionAttributes = event.sessionAttributes;
    if (!sessionAttributes) {
        sessionAttributes = {};
    }

    sessionAttributes.sessionObject = JSON.stringify(sessionObject);
    console.log('%j', sessionAttributes);
    callback(null, closeWithResponse(event, true, sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: listName + " loaded!!"
    }, {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "Working list:" + listName,
            subTitle: "Items: " + items_in_list.join(),
            buttons: [{
                "text": "add more things...",
                "value": "Add a new item to the list"
            }, {
                "text": "use this checklist",
                "value": "Next Item on the list"
            }]
        }]
    }));


}

function doEndList(event, callback) {

    if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
        var sessionObject = JSON.parse(event.sessionAttributes.sessionObject);

        if (sessionObject.currentSession)
            sessionObject.currentIndex = 0;
        var sessionAttributes = event.sessionAttributes;

        sessionAttributes.sessionObject = JSON.stringify(sessionObject);
        console.log('%j', sessionAttributes);
        callback(null, closeWithResponse(event, true, sessionAttributes, 'Fulfilled', {
            contentType: 'PlainText',
            content: sessionObject.currentSession + " list saved!!"
        }, {
            contentType: "application/vnd.amazonaws.card.generic",
            genericAttachments: [{
                title: "Saved list:" + sessionObject.currentSession,
                subTitle: "What would you like to do next?",
                buttons: [{
                    "text": "work on a new list?",
                    "value": "Load a list"
                }, {
                    "text": "use this checklist",
                    "value": "Next Item on the list"
                }]
            }]
        }));
        return;

    }
    callback(null, closeWithResponse(event, false, event.sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: "Could not find any list to save!!"
    }, {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "No active list!!",
            subTitle: "Would you want to start one?",
            buttons: [{
                "text": "start a new list?",
                "value": "Load a list"
            }]
        }]
    }));
}

function doNextItem(event, callback) {


    if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
        var sessionObject = JSON.parse(event.sessionAttributes.sessionObject);
        var sessionElement = null;
        if (sessionObject.currentSession) {
            var currentSession = sessionObject.currentSession;
            if (sessionObject.lists) {


                sessionObject.lists.forEach(function (element) {
                    if (element.name == currentSession) {

                        sessionElement = element;
                    }
                });

            }
            if (sessionObject.currentIndex != undefined && sessionElement && sessionElement.listItems && sessionElement.listItems.length > sessionObject.currentIndex) {
                var item = sessionElement.listItems[sessionObject.currentIndex];
                console.log("Current index:" + sessionObject.currentIndex);
                sessionObject.currentIndex += 1;
                var sessionAttributes = event.sessionAttributes;
                sessionAttributes.sessionObject = JSON.stringify(sessionObject);
                console.log('%j', sessionAttributes);
                callback(null, closeWithResponse(event, true, sessionAttributes, 'Fulfilled', {
                    contentType: 'PlainText',
                    content: "Check: " + item
                }, {
                    contentType: "application/vnd.amazonaws.card.generic",
                    genericAttachments: [{
                        title: "Running thru the list.." + sessionObject.currentSession,
                        subTitle: "Item: " + item,
                        buttons: [{
                            "text": "next item..",
                            "value": "Next Item on the list"
                        }, {
                            "text": "use some other list?",
                            "value": "Load a list"
                        }]
                    }]
                }));
            } else {
                sessionObject.currentIndex = 0;
                var sessionAttributes = event.sessionAttributes;
                sessionAttributes.sessionObject = JSON.stringify(sessionObject);
                console.log('%j', sessionAttributes);
                callback(null, closeWithResponse(event, true, sessionAttributes, 'Fulfilled', {
                    contentType: 'PlainText',
                    content: "Done with this list!!"
                }, {
                    contentType: "application/vnd.amazonaws.card.generic",
                    genericAttachments: [{
                        title: "What do we want to do next?",
                        subTitle: "You could ...",
                        buttons: [{
                            "text": "doubtful? check again",
                            "value": "Next Item on the list"
                        }, {
                            "text": "load some other list?",
                            "value": "Load a list"
                        }]
                    }]
                }));

            }

        } else {
            callback(null, close(event.sessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: "No list selected to add the item to!!"
            }));
        }

    } else {
        callback(null, close(event.sessionAttributes, 'Fulfilled', {
            contentType: 'PlainText',
            content: "No list selected to add the item to!!"
        }));
    }





}

function doLoadList(event, callback) {

    if (event.invocationSource == "DialogCodeHook" && !event.currentIntent.slots.EList) {

        var buttonsList = [];
        if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
            sessionObject = JSON.parse(event.sessionAttributes.sessionObject);
            console.log('%j', sessionObject);
            var lists = '';
            if (sessionObject.lists) {
                sessionObject.lists.forEach(function (element) {

                    lists += element.name + "\n";
                    var button = {};
                    button.text = element.name;
                    button.value = element.name;
                    buttonsList.push(button);

                });
                callback(null, elicitSlotWithResponse(event.sessionAttributes, event.currentIntent.name, {
                        "EList": null
                    },
                    "EList", {
                        contentType: 'PlainText',
                        content: "Pick from following ...\n"+lists
                    }, null

                ));


            }


        }

        return;

    }
    var listToBeLoaded = event.currentIntent.slots.EList;
    console.log("List to be loaded " + listToBeLoaded);

    var items_in_list = [];
    var sessionObject = {};
    if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
        sessionObject = JSON.parse(event.sessionAttributes.sessionObject);
    }

    var currentSession = '';
    if (sessionObject.currentSession) {

        currentSession = sessionObject.currentSession;
        console.log(" Changing from list " + currentSession + " to " + listToBeLoaded);
        sessionObject.currentSession = listToBeLoaded;
        currentSession = listToBeLoaded;
    } else {
        sessionObject.currentSession = listToBeLoaded;
        currentSession = listToBeLoaded;
    }
    if (sessionObject.lists) {

        var found = false;
        sessionObject.lists.forEach(function (element) {
            if (element.name == listToBeLoaded) {
                sessionObject.currentSession = listToBeLoaded;
                sessionObject.currentIndex = 0;
                items_in_list = element.listItems;
                var sessionAttributes = event.sessionAttributes;
                sessionAttributes.sessionObject = JSON.stringify(sessionObject);
                console.log('%j', sessionAttributes);
                callback(null, closeWithResponse(event, true, sessionAttributes, 'Fulfilled', {
                    contentType: 'PlainText',
                    content: listToBeLoaded + " loaded!!"
                }, {
                    contentType: "application/vnd.amazonaws.card.generic",
                    genericAttachments: [{
                        title: "Working list:" + listToBeLoaded,
                        subTitle: "Items: " + items_in_list.join(),
                        buttons: [{
                            "text": "add more things...",
                            "value": "Add a new item to the list"
                        }, {
                            "text": "use this checklist",
                            "value": "Next Item on the list"
                        }]
                    }]
                }));
                return;


            }
        });
        console.log(found);
        if (!found) {
            var list = {};
            list.name = currentSession;
            list.listItems = [];
            sessionObject.lists.push(list);

        }



    } else {
        sessionObject.lists = [];
        var list = {};
        list.name = currentSession;
        list.listItems = [];
        sessionObject.lists.push(list);

    }
    var sessionAttributes = event.sessionAttributes;
    if (!sessionAttributes)
        sessionAttributes = {};
    sessionAttributes.sessionObject = JSON.stringify(sessionObject);
    console.log('%j', sessionAttributes);
    callback(null, closeWithResponse(event, true, sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: listToBeLoaded + " loaded!!"
    }, {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "Working list:" + listToBeLoaded,
            subTitle: "No items in the list",
            buttons: [{
                "text": "add some things",
                "value": "Add a new item to the list"
            }]
        }]
    }));


}

function doGreeting(event, callback) {

    var newUser = "Hello, my name is Alfred, \n" +
        " I can help you with creating and maintaining task lists. \n" +
        "Some of the commands that I understand are...\n" +
        "What can you do for me\n" +
        "Create a new list\n" +
        "Add a new item to the list\n" +
        "Save the list\n" +
        "Run through a list\n" +
        "Next item\n" +
        "You can also use following shortcuts.";
    var existingUser = "Hi, welcome back.\n";


    var existingUserOptions = {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "Shortcuts",
            subTitle: "What do we want to do today? ",
            buttons: [{
                "text": "create a list",
                "value": "Create a new list"
            }, {
                "text": "run through a list",
                "value": "Run through a list"
            }]
        }]
    };

    var newUserOptions = {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "Shortcuts",
            subTitle: "Get started by creating... ",
            buttons: [{
                "text": "your first list",
                "value": "Create a new list"
            }, ]
        }]
    };

    var message = newUser;
    var options = newUserOptions;


    if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
        message = existingUser;
        options = existingUserOptions;
    }




    callback(null, closeWithResponse(event, false, event.sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: message
    }, options));
}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event1, context, callback) => {
    var event = event1;
    try {
        // By default, treat the user request as coming from the America/New_York time zone.
        process.env.TZ = 'America/New_York';
        console.log('%j', event);

        if (event.sessionAttributes == undefined || event.sessionAttributes.sessionObject == undefined) {
            var docClient = new AWS.DynamoDB.DocumentClient();
            var params = {
                TableName: "AlfredBot",
                Key: {
                    "userID": event.userId
                }
            }
            docClient.get(params, function (err, data) {
                if (err) {
                    console.log("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                } else {
                    console.log("GetItem succeeded:", JSON.stringify(data, null, 2));
                }
                if (data && data.Item && data.Item.info) {
                    console.log("Loading data from DB!!");
                    var sessionObject = data.Item.info;
                    if (event.sessionAttributes)
                        event.sessionAttributes.sessionObject = sessionObject;
                    else {
                        event.sessionAttributes = {};
                        event.sessionAttributes.sessionObject = sessionObject;
                    }
                }


                switch (event.currentIntent.name) {
                    case 'AddtoList':
                        console.log('Entering add to list');
                        doAddToList(event, callback);
                        break;
                    case 'CreateListIntent':
                        console.log('Entering createlist intent');
                        doCreateList(event, callback);
                        break;
                    case 'EndList':
                        console.log('Endling the list');
                        doEndList(event, callback);
                        break;
                    case 'LoadList':
                        console.log('Loading the list');
                        doLoadList(event, callback);
                        break;
                    case 'NextItemOnList':
                        console.log('Next item on the list');
                        doNextItem(event, callback);
                        break;
                    case 'Hello':
                        console.log('In Hello');
                        doGreeting(event, callback);
                        break;
                    default:
                        callback(null, close(event.sessionAttributes, 'Fulfilled', {
                            contentType: 'PlainText',
                            content: "Could not understand the intent"
                        }));
                        break;



                }
                callback(null, close(event.sessionAttributes, 'Fulfilled', {
                    contentType: 'PlainText',
                    content: "All Ok"
                }));
            });






        } else {
            switch (event.currentIntent.name) {
                case 'AddtoList':
                    console.log('Entering add to list');
                    doAddToList(event, callback);
                    break;
                case 'CreateListIntent':
                    console.log('Entering createlist intent');
                    doCreateList(event, callback);
                    break;
                case 'EndList':
                    console.log('Endling the list');
                    doEndList(event, callback);
                    break;
                case 'LoadList':
                    console.log('Loading the list');
                    doLoadList(event, callback);
                    break;
                case 'NextItemOnList':
                    console.log('Next item on the list');
                    doNextItem(event, callback);
                    break;
                case 'Hello':
                    console.log('In Hello');
                    doGreeting(event, callback);
                    break;
                default:
                    callback(null, close(event.sessionAttributes, 'Fulfilled', {
                        contentType: 'PlainText',
                        content: "Could not understand the intent"
                    }));
                    break;



            }
            callback(null, close(event.sessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: "All Ok"
            }));

        }


        // dispatch(event, (response) => callback(null, response));
    } catch (err) {

        console.log('%j', err);
        callback(err);
    }
};