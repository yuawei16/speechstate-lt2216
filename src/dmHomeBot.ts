
/* 
    Intent recognition
    The home bot will offer 4 services.
*/
import { Context } from "microsoft-cognitiveservices-speech-sdk/distrib/lib/src/common.speech/RecognizerConfig";
import { MachineConfig, send, Action, assign, createMachine } from "xstate";


function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

const grammar: { [index: string]: { title?: string, day?: string, time?: string } } = {
    "Lecture.": { title: "Dialogue systems lecture" },
    "Lunch.": { title: "Lunch at the canteen" },
    "On Friday.": { day: "Friday" },
    "At 10": { time: "10:00" },
}

const myGrammar = {services:['vacuum', 'dump_trash', 'turn_on_light', 'turn_off_light']}

const rasaurl = 'https://rasa-nlu-yw.herokuapp.com/model/parse'
const nluRequest = (text: string) =>
  fetch(new Request(rasaurl, {
      method: 'POST',
      body: `{"text": "${text}"}`})).then(data => data.json())

const sayAppointment: Action<SDSContext, SDSEvent> = send((context: SDSContext) => ({
    type: "SPEAK", value: `Do you want to create a meeting titled ${context.title} on ${context.day}`
}))

export const dmMachine: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'idle',
    states: {
        idle: {
            on: {
                CLICK: 'init'
            }
        },
        init: {
            on: {
                TTS_READY: 'openning',
                CLICK: 'openning'
            }
        },
        openning: {
            initial: 'prompt',
            entry: (context) => context.counter = 0,
            on: {
                RECOGNISED: [
                    {
                        target: 'welcome',
                        actions: assign({ userName: (context) => context.recResult[0].utterance })
                    },
                    {
                        target: '.nomatch'
                    }
                ],
                TIMEOUT: '.prompt'
            },
            states: {
                prompt: {
                    entry: say("Tell me your name please."),
                    on: { ENDSPEECH: 'ask' }
                },
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
      
        welcome: {
            initial: 'prompt',
            entry: (context) => context.counter = 0,
            on: {
                RECOGNISED: [
                    {
                        target: 'intentSwitch'
                    },
                    {
                        target: '.nomatch'
                    }
                ],
               
                TIMEOUT: [{target: '.prompt', cond: (context) => context.counter % 3 !== 0},
                          {target: '.botServices', cond: (context) => context.counter % 3 === 0}]
            },
            states: {
                prompt: {
                    entry: [send((context: SDSContext) => ({
                        type: "SPEAK", value: `Hi ${context.userName}. What can I do for you? `})),
                        (context) => context.counter + 1],
                    on: { ENDSPEECH: 'ask' }
                },
             
                botServices: {
                    entry: say('Here is a list of what I can do: vacuum, dump trash, turn on light, or turn off light.'),
                    on: {ENDSPEECH: 'prompt'}
                },
               
                ask: {
                    entry: send('LISTEN'),
                },
                nomatch: {
                    entry: say("Sorry, I don't know what it is. Tell me something I know."),
                    on: { ENDSPEECH: 'ask' }
                }
            }
        },
        intentSwitch:{ 
            id: 'intentSwitch',
            initial: 'prompt',
            states: {
                prompt: {
                    entry: say("Let me check the inventory."),
                    on: { ENDSPEECH: 'getIntentRasa' }
                },
                getIntentRasa: {
                    id: 'getIntentRasa',
                    invoke: {
                        src: (context) => nluRequest(context.recResult[0].utterance),
                        onDone: {
                            target: 'success',
                            actions: assign({ intent: (context, event) => event.data.intent.name}),     
                        },
                        onError: {
                            target: 'fail',
                            actions: (context, event) => console.log(context, event)
                        }
                    }
                },
                success: {
                    always: [
                        {
                            target: '#root.dm.vacuum',
                            cond: (context) => context.intent === 'vacuum'
                        },
                        {
                            target: '#root.dm.dump_trash',
                            cond: (context) => context.intent === 'move_to_trash'
                        },
                        {
                            target: '#root.dm.turn_on_light',
                            cond: (context) => context.intent === 'turn_on_light'
                        },
                        {
                            target: '#root.dm.turn_off_light',
                            cond: (context) => context.intent === 'turn_off_light'
                        }
                    ],
                },
                fail: {},
                hist: {
                    type: 'history',
                    history: 'deep'
                }
            }             
        },
        vacuum:{ 
            initial: 'prompt',
            on: {},
            states:{
                prompt: {
                    entry: say("OK, start vacuuming"),
                    on: {ENDSPEECH: 'jobFinished'}
                },
                jobFinished: {
                    entry: say("I am vacuuming and it will be fone in 1 second."),
                    after: {
                        1000: {target: '#root.dm.welcome'}
                    }
                }
            }
        },
        dump_trash: {
            initial: 'prompt',
            on: {},
            states:{
                prompt: {
                    entry: say("OK, start dumpping the trash"),
                    on: {ENDSPEECH: 'jobFinished'}
                },
                jobFinished: {
                    entry: say("The trash is dumpped."),
                    after: {
                        500: {target: '#root.dm.welcome'}
                    }
                }
            }
        },
        turn_on_light: {
            initial: 'prompt',
            on: {},
            states:{
                prompt: {
                    entry: say("OK, trun on the light."),
                    on: {ENDSPEECH: 'jobFinished'}
                },
                jobFinished: {
                    entry: say("Now the light is on."),
                    after: {
                        500: {target: '#root.dm.welcome'}
                    }
                }
            }
        },
        turn_off_light: {
            initial: 'prompt',
            on: {},
            states:{
                prompt: {
                    entry: say("OK, turn off the light"),
                    on: {ENDSPEECH: 'jobFinished'}
                },
                jobFinished: {
                    entry: say("Now the light is off."),
                    after: {
                        500: {target: '#root.dm.welcome'}
                    }
                }
            }
        },
        info: {
            entry: send((context) => ({
                type: 'SPEAK',
                value: `OK, ${context.title}`
            })),
            on: { ENDSPEECH: 'init' }
        }
    }
})
