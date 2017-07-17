'use strict';

/**
 * This sample demonstrates an implementation of the Lex Code Hook Interface
 * in order to serve a sample bot which manages orders for flowers.
 * Bot, Intent, and Slot models which are compatible with this sample can be found in the Lex Console
 * as part of the 'OrderFlowers' template.
 *
 * For instructions on how to set up and test this bot, as well as additional samples,
 *  visit the Lex Getting Started documentation.
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
    console.log('%j',returnval);
    return returnval;
}

function closeWithResponse(sessionAttributes, fulfillmentState, message, responseCard) {

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

// ---------------- Helper Functions --------------------------------------------------

function parseLocalDate(date) {
    /**
     * Construct a date object in the local timezone by parsing the input date string, assuming a YYYY-MM-DD format.
     * Note that the Date(dateString) constructor is explicitly avoided as it may implicitly assume a UTC timezone.
     */
    const dateComponents = date.split(/\-/);
    return new Date(dateComponents[0], dateComponents[1] - 1, dateComponents[2]);
}

function isValidDate(date) {
    try {
        return !(isNaN(parseLocalDate(date).getTime()));
    } catch (err) {
        return false;
    }
}

function buildValidationResult(isValid, violatedSlot, messageContent) {
    if (messageContent == null) {
        return {
            isValid,
            violatedSlot,
        };
    }
    return {
        isValid,
        violatedSlot,
        message: {
            contentType: 'PlainText',
            content: messageContent
        },
    };
}

function validateOrderFlowers(flowerType, date, time) {
    const flowerTypes = ['lilies', 'roses', 'tulips'];
    if (flowerType && flowerTypes.indexOf(flowerType.toLowerCase()) === -1) {
        return buildValidationResult(false, 'FlowerType', `We do not have ${flowerType}, would you like a different type of flower?  Our most popular flowers are roses`);
    }
    if (date) {
        if (!isValidDate(date)) {
            return buildValidationResult(false, 'PickupDate', 'I did not understand that, what date would you like to pick the flowers up?');
        }
        if (parseLocalDate(date) < new Date()) {
            return buildValidationResult(false, 'PickupDate', 'You can pick up the flowers from tomorrow onwards.  What day would you like to pick them up?');
        }
    }
    if (time) {
        if (time.length !== 5) {
            // Not a valid time; use a prompt defined on the build-time model.
            return buildValidationResult(false, 'PickupTime', null);
        }
        const hour = parseInt(time.substring(0, 2), 10);
        const minute = parseInt(time.substring(3), 10);
        if (isNaN(hour) || isNaN(minute)) {
            // Not a valid time; use a prompt defined on the build-time model.
            return buildValidationResult(false, 'PickupTime', null);
        }
        if (hour < 10 || hour > 16) {
            // Outside of business hours
            return buildValidationResult(false, 'PickupTime', 'Our business hours are from ten a m. to five p m. Can you specify a time during this range?');
        }
    }
    return buildValidationResult(true, null, null);
}

// --------------- Functions that control the bot's behavior -----------------------

/**
 * Performs dialog management and fulfillment for ordering flowers.
 *
 * Beyond fulfillment, the implementation of this intent demonstrates the use of the elicitSlot dialog action
 * in slot validation and re-prompting.
 *
 */
function orderFlowers(intentRequest, callback) {
    const flowerType = intentRequest.currentIntent.slots.FlowerType;
    const date = intentRequest.currentIntent.slots.PickupDate;
    const time = intentRequest.currentIntent.slots.PickupTime;
    const source = intentRequest.invocationSource;

    if (source === 'DialogCodeHook') {
        // Perform basic validation on the supplied input slots.  Use the elicitSlot dialog action to re-prompt for the first violation detected.
        const slots = intentRequest.currentIntent.slots;
        const validationResult = validateOrderFlowers(flowerType, date, time);
        if (!validationResult.isValid) {
            slots[`${validationResult.violatedSlot}`] = null;
            callback(elicitSlot(intentRequest.sessionAttributes, intentRequest.currentIntent.name, slots, validationResult.violatedSlot, validationResult.message));
            return;
        }

        // Pass the price of the flowers back through session attributes to be used in various prompts defined on the bot model.
        const outputSessionAttributes = intentRequest.sessionAttributes || {};
        if (flowerType) {
            outputSessionAttributes.Price = flowerType.length * 5; // Elegant pricing model
        }
        callback(delegate(outputSessionAttributes, intentRequest.currentIntent.slots));
        return;
    }

    // Order the flowers, and rely on the goodbye message of the bot to define the message to the end user.  In a real bot, this would likely involve a call to a backend service.
    callback(close(intentRequest.sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: `Thanks, your order for ${flowerType} has been placed and will be ready for pickup by ${time} on ${date}`
    }));
}

// --------------- Intents -----------------------

/**
 * Called when the user specifies an intent for this skill.
 */
function dispatch(intentRequest, callback) {
    console.log(`dispatch userId=${intentRequest.userId}, intentName=${intentRequest.currentIntent.name}`);

    const intentName = intentRequest.currentIntent.name;

    // Dispatch to your skill's intent handlers
    if (intentName === 'OrderFlowers') {
        return orderFlowers(intentRequest, callback);
    }
    throw new Error(`Intent with name ${intentName} not supported`);
}


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
            callback(null, closeWithResponse(sessionAttributes, 'Fulfilled', {
                contentType: 'PlainText',
                content: event.currentIntent.slots.ListItem + " added !!"
            }, {
                contentType: "application/vnd.amazonaws.card.generic",
                genericAttachments: [{
                    title: "Working list:" + sessionObject.currentSession,
                    subTitle: "You could now...",
                    buttons: [{
                        "text": "Add more to the list?",
                        "value": "Add a new item to the list"
                    }, {
                        "text": "Save list?",
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
    callback(null, closeWithResponse(sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: listName + " loaded!!"
    }, {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "Working list:" + listName,
            subTitle: "Items: " + items_in_list.join(),
            buttons: [{
                "text": "Add more to the list?",
                "value": "Add a new item to the list"
            }, {
                "text": "Run through this list one by one?",
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
        callback(null, closeWithResponse(sessionAttributes, 'Fulfilled', {
            contentType: 'PlainText',
            content: sessionObject.currentSession + " list saved!!"
        }, {
            contentType: "application/vnd.amazonaws.card.generic",
            genericAttachments: [{
                title: "Saved list:" + sessionObject.currentSession,
                subTitle: "What would you like to do next?",
                buttons: [{
                    "text": "Work on a new list?",
                    "value": "Load a list"
                }, {
                    "text": "Run through the items in this list one by one?",
                    "value": "Next Item on the list"
                }]
            }]
        }));
        return;

    }
    callback(null, close(event.sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: "Could not find any list to save!!"
    }, {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "No active list!!",
            subTitle: "Would you want to start one?",
            buttons: [{
                "text": "Start a new list?",
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
                callback(null, closeWithResponse(sessionAttributes, 'Fulfilled', {
                    contentType: 'PlainText',
                    content: "Check: " + item
                }, {
                    contentType: "application/vnd.amazonaws.card.generic",
                    genericAttachments: [{
                        title: "Running thru the list.." + sessionObject.currentSession,
                        subTitle: "Item: " + item,
                        buttons: [{
                            "text": "Jump to next item?",
                            "value": "Next Item on the list"
                        }, {
                            "text": "Load some other list?",
                            "value": "Load a list"
                        }]
                    }]
                }));
            } else {
                sessionObject.currentIndex = 0;
                var sessionAttributes = event.sessionAttributes;
                sessionAttributes.sessionObject = JSON.stringify(sessionObject);
                console.log('%j', sessionAttributes);
                callback(null, closeWithResponse(sessionAttributes, 'Fulfilled', {
                    contentType: 'PlainText',
                    content: "Done with this list!!"
                }, {
                    contentType: "application/vnd.amazonaws.card.generic",
                    genericAttachments: [{
                        title: "What do we want to do next?",
                        subTitle: "You could ...",
                        buttons: [{
                            "text": "Check again?",
                            "value": "Next Item on the list"
                        }, {
                            "text": "Load some other list?",
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

    if (event.invocationSource == "DialogCodeHook") {

        var buttonsList = [];
        if (event.sessionAttributes && event.sessionAttributes.sessionObject) {
            sessionObject = JSON.parse(event.sessionAttributes.sessionObject);
            console.log('%j',sessionObject);
            if (sessionObject.lists) {
                sessionObject.lists.forEach(function (element) {

                    var button = {};
                    button.text = element.name;
                    button.value = element.name;
                    buttonsList.push(button);

                });
                callback(null, elicitSlotWithResponse(event.sessionAttributes, event.currentIntent.name, {
                        "EList": "work"
                    },
                    "EList", {
                        contentType: 'PlainText',
                        content: "Listing existing lists..."
                    }, {
                        contentType: "application/vnd.amazonaws.card.generic",
                        genericAttachments: [{
                            title: "Available lists",
                            subTitle: "Pick from...",
                            buttons: buttonsList
                        }]
                    }

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
                callback(null, closeWithResponse(sessionAttributes, 'Fulfilled', {
                    contentType: 'PlainText',
                    content: listToBeLoaded + " loaded!!"
                }, {
                    contentType: "application/vnd.amazonaws.card.generic",
                    genericAttachments: [{
                        title: "Working list:" + listToBeLoaded,
                        subTitle: "Items: " + items_in_list.join(),
                        buttons: [{
                            "text": "Add more to the list?",
                            "value": "Add a new item to the list"
                        }, {
                            "text": "Run through this list one by one?",
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
    callback(null, closeWithResponse(sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: listToBeLoaded + " loaded!!"
    }, {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "Working list:" + listToBeLoaded,
            subTitle: "No items in the list",
            buttons: [{
                "text": "Add some?",
                "value": "Add a new item to the list"
            }]
        }]
    }));


}

function doGreeting(event, callback) {

    callback(null, closeWithResponse(event.sessionAttributes, 'Fulfilled', {
        contentType: 'PlainText',
        content: "Hello, my name is Alfred, \n" +
            " I can help you with creating and maintaining task lists. \n" +
            "Some of the commands that I understand are...\n" +
            "What can you do for me\n" +
            "Create a new list\n" +
            "Add a new item to the list" +
            "Save the list\n" +
            "Run through a list\n" +
            "Next item\n" +
            "You can also use following shortcuts."
    }, {
        contentType: "application/vnd.amazonaws.card.generic",
        genericAttachments: [{
            title: "Shortcuts",
            subTitle: "Let's get you started... ",
            buttons: [{
                "text": "Create a list",
                "value": "Create a new list"
            }, {
                "text": "Add a new item to the list",
                "value": "Add a new item to the list"
            }, {
                "text": "Save the list",
                "value": "Save the list"
            }, {
                "text": "Run through a list",
                "value": "Run through a list"
            }]
        }]
    }));
}

// --------------- Main handler -----------------------

// Route the incoming request based on intent.
// The JSON body of the request is provided in the event slot.
exports.handler = (event, context, callback) => {
    try {
        // By default, treat the user request as coming from the America/New_York time zone.
        process.env.TZ = 'America/New_York';
        console.log('%j', event);

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

        // dispatch(event, (response) => callback(null, response));
    } catch (err) {

        console.log('%j', err);
        callback(err);
    }
};