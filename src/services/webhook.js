'use strict';

const axios = require('axios');
const config = require('../config.json');

/**
 * WebhookController relay class.
 */
class WebhookController {
    static instance = new WebhookController(config.webhooks.urls, config.webhooks.delay);

    constructor(urls, delay = 5) {
        console.info('[WebhookController] Starting up...');
        this.urls = urls;
        this.delay = delay;
        this.pokemonEvents = [];
        this.pokestopEvents = [];
        this.lureEvents = [];
        this.invasionEvents = [];
        this.questEvents = [];
        this.gymEvents = [];
        this.gymInfoEvents = [];
        this.raidEvents = [];
        this.eggEvents = [];
        this.weatherEvents = [];
    }

    /**
     * Starts the webhook sending interval timer
     */
    start() {
        this.timer = setInterval(() => this.loopEvents(), this.delay * 1000);
    }

    /**
     * Stops the webhook timer
     */
    stop() {
        // Stop the timer
        clearInterval(this.timer);
    }

    /**
     * Add Pokemon event json to pokemon events queue
     * @param {*} pokemon 
     */
    addPokemonEvent(pokemon) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.pokemonEvents.push(pokemon);
    }

    addPokestopEvent(pokestop) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.pokestopEvents.push(pokestop);
    }

    addLureEvent(pokestop) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.lureEvents.push(pokestop);
    }

    addInvasionEvent(pokestop) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.invasionEvents.push(pokestop);
    }

    addQuestEvent(pokestop) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.questEvents.push(pokestop);
    }

    addGymEvent(gym) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.gymEvents.push(gym);
    }

    addGymInfoEvent(gym) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.gymInfoEvents.push(gym);
    }

    addEggEvent(gym) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.eggEvents.push(gym);
    }

    addRaidEvent(gym) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.raidEvents.push(gym);
    }

    addWeatherEvent(weather) {
        if (!config.webhooks.enabled || this.urls.length === 0) {
            return;
        }
        this.weatherEvents.push(weather);
    }

    /**
     * Loop through the events and send them off to each webhool url
     */
    loopEvents() {
        let events = [];
        // Check if any queued pokemon events
        if (this.pokemonEvents.length > 0) {
            // Grab and remove the last pokemon event from the queue
            let pokemonEvent = this.pokemonEvents.pop()
            // Push pokemon event to new events queue with all types
            events.push(pokemonEvent);
        }

        // Check if any queued pokestop events
        if (this.pokestopEvents.length > 0) {
            // Grab and remove the last pokestop event from the queue
            let pokestopEvent = this.pokestopEvents.pop()
            // Push pokestop event to new events queue with all types
            events.push(pokestopEvent);
        }
        
        // Check if any queued lure events
        if (this.lureEvents.length > 0) {
            // Grab and remove the last lure event from the queue
            let lureEvent = this.lureEvents.pop()
            // Push lure event to new events queue with all types
            events.push(lureEvent);
        }
        
        // Check if any queued invasion events
        if (this.invasionEvents.length > 0) {
            // Grab and remove the last invasion event from the queue
            let invasionEvent = this.invasionEvents.pop()
            // Push invasion event to new events queue with all types
            events.push(invasionEvent);
        }
        
        // Check if any queued quest events
        if (this.questEvents.length > 0) {
            // Grab and remove the last quest event from the queue
            let questEvent = this.questEvents.pop()
            // Push quest event to new events queue with all types
            events.push(questEvent);
        }
        
        // Check if any queued gym events
        if (this.gymEvents.length > 0) {
            // Grab and remove the last gym event from the queue
            let gymEvent = this.gymEvents.pop()
            // Push gym event to new events queue with all types
            events.push(gymEvent);
        }
        
        // Check if any queued gym info events
        if (this.gymInfoEvents.length > 0) {
            // Grab and remove the last gym info event from the queue
            let gymInfoEvent = this.gymInfoEvents.pop()
            // Push gym info event to new events queue with all types
            events.push(gymInfoEvent);
        }
        
        // Check if any queued egg events
        if (this.eggEvents.length > 0) {
            // Grab and remove the last egg event from the queue
            let eggEvent = this.eggEvents.pop()
            // Push egg event to new events queue with all types
            events.push(eggEvent);
        }
        
        // Check if any queued raid events
        if (this.raidEvents.length > 0) {
            // Grab and remove the last raid event from the queue
            let raidEvent = this.raidEvents.pop()
            // Push raid event to new events queue with all types
            events.push(raidEvent);
        }

        // Check if any queued weather events
        if (this.weatherEvents.length > 0) {
            // Grab and remove the last weather event from the queue
            let weatherEvent = this.weatherEvents.pop()
            // Push weather event to new events queue with all types
            events.push(weatherEvent);
        }
        

        // Check if any events in the array
        if (events.length > 0) {
            // Send the events to each webhook
            this.urls.forEach(url => this.sendEvents(events, url));
        }
    }

    /**
     * Send the webhook events to the provided webhook endpoint
     * @param {*} events 
     * @param {*} url 
     */
    sendEvents(events, url) {
        // If events is not set, skip..
        if (!events) {
            return;
        }
        // axios request options
        let options = {
            url: url,
            method: 'POST',
            data: events,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'User-Agent': 'Nodedradamus'
            }
        };
        // Send request
        axios(options)
            .then(x => console.log('[WebhookController] Webhook event with', events.length, 'payloads sent to', url))
            .catch(err => {
                if (err) {
                    console.error('[WebhookController] Error occurred, trying again:', err);
                    this.sendEvents(events, url);
                    return;
                }
            });
    }
}

module.exports = WebhookController;