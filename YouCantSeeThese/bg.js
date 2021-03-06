Parse.initialize("RLrGIdVcBOjo80GwB5fi3xi3lCZ0Qk2RpO9fXiGr", "Lmu4rEdndfn1ihx2vDNIISC9O1MrI9FRarzJGul3");

var parser = document.createElement('a');
var lastHostname = null;
var lastTitle = null;
var lastTime = Date.now();
var go = true;

chrome.browserAction.onClicked.addListener(function () {
    window.open("index.html");
});

function getRandomToken() {
    // E.g. 8 * 32 = 256 bits token
    var randomPool = new Uint8Array(32);
    crypto.getRandomValues(randomPool);
    var hex = '';
    for (var i = 0; i < randomPool.length; ++i) {
        hex += randomPool[i].toString(16);
    }
    // E.g. db18458e2782b2b77e36769c569e263a53885a9944dd0a861e5064eac16f1a
    return hex;
}

function handleParseError(err, userId, userPass) {
    switch (err.code) {
        case Parse.Error.INVALID_SESSION_TOKEN:
        {
            Parse.User.logOut().then(
                function () {
                    logIn(userId, userPass);
                }
            );

            console.log("Log In Error: " + err.code + " " + err.message);
            break;
        }
        case 101:
        {
            signUp(userId, userPass);
            console.log("Log In Error: " + err.code + " " + err.message);
            break;
        }
        default :
        {
            console.log("Log In Error: " + err.code + " " + err.message);
        }
    }
}
function logIn(userId, userPass) {
    Parse.User.logIn(userId, userPass, {
        success: function () {
            console.log("Log In Success");
            currUser = Parse.User.current();
            main();
        },
        error: function (pUser, error) {
            // The login failed. Check error to see why.
            handleParseError(error, userId, userPass);

        }
    });
}

function signUp(userId, userPass) {

    var parseUser = new Parse.User();
    parseUser.set("username", userId);
    parseUser.set("password", userPass);
    parseUser.signUp(null, {
        success: function () {
            console.log("Sign Up Success");
            currUser = Parse.User.current();
            main();
        },
        error: function (pUser, error) {
            // Show the error message somewhere and let the user try again.
            console.log("Sign Up Error: " + error.code + " " + error.message);
        }
    });
}


chrome.storage.sync.get(['userId', 'userPass'], function (result) {
    if (result.userId) {
        console.log("logging in");

        logIn(result.userId, result.userPass);
    } else {
        console.log("Signing up");
        var userId = getRandomToken();
        var userPass = getRandomToken();
        chrome.storage.sync.set({userId: userId, userPass: userPass}, function () {
            signUp(userId, userPass);
        });
    }
});


function main() {

    var username = currUser.get('username');


    function log(url, title, tab) {
        if (go) {
            parser.href = url;
            var hostname = parser.hostname;
            var newTabTitle = "New Tab";
            var pBGTitle = "Procrastination Be Gone";
            if (hostname !== lastHostname) {
                if(lastTitle !== newTabTitle && lastTitle !== pBGTitle && lastTitle !== null){
                    updateUrl(lastHostname, lastTitle, Date.now()- lastTime);
                }
                lastTitle = title;
                lastHostname = hostname;
                lastTime = Date.now();
            }

            checkIfBlocked(hostname, tab);

        }
    }

    function checkIfBlocked(hostname, tab){
        var blockedSite = Parse.Object.extend("BlockedSite");
        var query = new Parse.Query(blockedSite);
        query.equalTo("user", username);
        query.find({
            success: function (results) {
                for (var i = 0; i < results.length; i++) {
                    var object = results[i];
                    if (object.get("hostname") === hostname) {
                        chrome.tabs.update(tab.id, {url: "redirect.html"});
                        console.log("matched ", hostname);

                    } else {
                        console.log("didn't match ", hostname, object.get("hostname"));
                    }
                }
            },
            error: function (error) {

                console.log("Error: " + error.code + " " + error.message);
            }
        });


    }

    function updateUrl(hostname, title, timeSpent) {
        var Site = Parse.Object.extend("Site");

        var query = new Parse.Query(Site);
        query.equalTo("user", username);
        query.equalTo("hostname", hostname);
        query.first({
            success: function (object) {
                if (object) {
                    object.set("timeSpent", timeSpent + object.get("timeSpent"));
                    object.set("title", title);
                    console.log("Saving object ", title, hostname,timeSpent);
                    object.save();
                } else {
                    var site1 = new Site();
                    site1.save({
                        user: username,
                        hostname: hostname,
                        timeSpent: timeSpent,
                        title: title
                    }).then(function (object) {
                        console.log("New object", title, hostname,timeSpent );

                    });
                }

            },
            error: function (error) {
                console.log("Error: " + error.code + " " + error.message);
            }
        });


    }

    chrome.tabs.onActivated.addListener(function (activeInfo) {
        chrome.tabs.get(activeInfo.tabId, function (tab) {
            if (tab.status === "complete" && tab.active) {
                chrome.windows.get(tab.windowId, {populate: false}, function (window) {
                    if (window.focused) {
                        log(tab.url, tab.title || null, tab);
                    }
                });
            }
        });
    });

    chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
        if (changeInfo.status === "complete" && tab.active) {
            chrome.windows.get(tab.windowId, {populate: false}, function (window) {
                if (window.focused) {
                    log(tab.url, tab.title || null, tab);
                }
            });
        }
    });

    chrome.windows.onFocusChanged.addListener(function (windowId) {
        if (windowId == chrome.windows.WINDOW_ID_NONE) {
            log(null, null, null);
        } else {
            chrome.windows.get(windowId, {populate: true}, function (window) {
                if (window.focused) {
                    chrome.tabs.query({active: true, windowId: windowId}, function (tabs) {
                        if (tabs[0].status === "complete") {
                            log(tabs[0].url, tabs[0].title || null, tabs[0]);
                        }
                    });
                }
            });
        }
    });


}