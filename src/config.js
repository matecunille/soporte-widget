export const defaultConfig = {
    apiUrl: "",
    clientId: "",
    title: "Soporte",
    subtitle: "Chat con nuestro equipo",
    primaryColor: "#FE7109",
    position: "right",
    senderIdentifier: "",
    credentials: null,       // { userName, password } — set by host page for auto-init
    senderCompany: "",       
    welcomeMessage: "Hola, ¿en qué podemos ayudarte?",
    avatarImage: "",
    avatarLetter: "S",
    agentName: "Soporte",
    soundEnabled: true,
    zIndex: 9999
};

export function mergeConfig(userConfig = {}) {
    const config = {};
    for (let key in defaultConfig) {
        config[key] = defaultConfig[key];
    }
    for (let key in userConfig) {
        if (userConfig.hasOwnProperty(key)) {
            config[key] = userConfig[key];
        }
    }
    return config;
}