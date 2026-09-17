speechSynthesis.getVoices();

let vozesCarregadas = false;

speechSynthesis.onvoiceschanged = () => {
    vozesCarregadas = true;
};

const canvas = document.getElementById("tela");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let tamanho = 20;
let falando = false;
let intensidade = 20;


// ===============================
// ANIMAÇÃO DA LINHA
// ===============================

function desenhar() {

    requestAnimationFrame(desenhar);

    tamanho +=
        (intensidade - tamanho) * 0.2;

    ctx.fillStyle = "black";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 5;

    ctx.beginPath();

    for (let x = 0; x < canvas.width; x++) {

        let y =
            canvas.height / 2 +
            Math.sin(x * 0.02) * tamanho;

        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();
}

desenhar();


// ===============================
// RECONHECIMENTO DE VOZ
// ===============================

const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition;

let reconhecimento = null;
let escutaAtiva = false;

function iniciarReconhecimento() {
    if (!SpeechRecognition) {
        document.getElementById("status").innerText =
            "Reconhecimento de voz não suportado.";
        return;
    }

    if (reconhecimento) {
        try {
            reconhecimento.start();
        } catch {
            // Já está iniciando, ignora.
        }
        return;
    }

    reconhecimento = new SpeechRecognition();
    reconhecimento.lang = "pt-BR";
    reconhecimento.continuous = true;
    reconhecimento.interimResults = false;

    reconhecimento.onstart = () => {
        escutaAtiva = true;
        document.getElementById("status").innerText = "Karen ouvindo...";
    };

    reconhecimento.onresult = async (event) => {
        if (falando) return;

        falando = true;

        try {
            reconhecimento.stop();
        } catch {
            // ignora se já foi parado
        }

        const texto =
            event.results[
                event.results.length - 1
            ][0].transcript;

        console.log("Você:", texto);

        document.getElementById("status")
            .innerText = "Pensando...";

        try {
            const resposta = await fetch(
                "/api/karen",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ mensagem: texto })
                }
            );

            const textoResposta = await resposta.text();
            let dados = {};

            try {
                dados = JSON.parse(textoResposta);
            } catch {
                dados = {};
            }

            if (!resposta.ok) {
                throw new Error(
                    dados.erro || "Erro ao conectar com a Karen."
                );
            }

            const respostaKaren =
                dados.resposta || "Não consegui responder.";

            console.log("Karen:", respostaKaren);

            document.getElementById("status")
                .innerText = "Karen falando...";

            const iniciarAudioLocal = () => {
                const voz = new SpeechSynthesisUtterance(respostaKaren);
                voz.lang = "pt-BR";

                const vozes = speechSynthesis.getVoices();
                voz.voice =
                    vozes.find(v => v.name.includes("Google português do Brasil")) ||
                    vozes.find(v => v.lang === "pt-BR") ||
                    vozes[0];

                voz.pitch = 0.9;
                voz.rate = 1;
                voz.volume = 1;

                const animacao = setInterval(() => {
                    intensidade = 20 + Math.random() * 60;
                }, 80);

                voz.onend = () => {
                    clearInterval(animacao);
                    intensidade = 20;
                    tamanho = 20;
                    falando = false;
                    document.getElementById("status").innerText = "Karen ouvindo...";

                    if (escutaAtiva) {
                        try {
                            reconhecimento.start();
                        } catch {
                            // ignora reinício duplicado
                        }
                    }
                };

                voz.onerror = () => {
                    clearInterval(animacao);
                    intensidade = 20;
                    tamanho = 20;
                    falando = false;
                    document.getElementById("status").innerText = "Karen ouvindo...";

                    if (escutaAtiva) {
                        try {
                            reconhecimento.start();
                        } catch {
                            // ignora reinício duplicado
                        }
                    }
                };

                speechSynthesis.cancel();
                speechSynthesis.speak(voz);
            };

            try {
                const respostaAudio = await fetch("/api/voice", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ texto: respostaKaren })
                });

                if (respostaAudio.ok) {
                    const audioBlob = await respostaAudio.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);

                    const encerrarAudio = () => {
                        URL.revokeObjectURL(audioUrl);
                        falando = false;
                        intensidade = 20;
                        tamanho = 20;
                        document.getElementById("status").innerText = "Karen ouvindo...";

                        if (escutaAtiva) {
                            try {
                                reconhecimento.start();
                            } catch {
                                // ignora reinício duplicado
                            }
                        }
                    };

                    audio.onended = encerrarAudio;
                    audio.onerror = () => {
                        encerrarAudio();
                        iniciarAudioLocal();
                    };

                    audio.play().catch(() => {
                        encerrarAudio();
                        iniciarAudioLocal();
                    });

                    return;
                }
            } catch (erroAudio) {
                console.warn("Fallback para voz do navegador:", erroAudio);
            }

            iniciarAudioLocal();
        } catch (erro) {
            console.error(erro);
            falando = false;
            intensidade = 20;
            tamanho = 20;
            document.getElementById("status").innerText =
                erro.message || "Erro ao conectar com a Karen.";

            if (escutaAtiva) {
                try {
                    reconhecimento.start();
                } catch {
                    // ignora reinício duplicado
                }
            }
        }
    };

    reconhecimento.onerror = (event) => {
        console.error("Erro de reconhecimento:", event.error);

        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            document.getElementById("status").innerText =
                "Clique na tela e permita o microfone para a Karen ouvir.";
            escutaAtiva = false;
            return;
        }

        if (!falando && escutaAtiva) {
            try {
                reconhecimento.start();
            } catch {
                // ignora reinício duplicado
            }
        }
    };

    reconhecimento.onend = () => {
        if (!falando && escutaAtiva) {
            try {
                reconhecimento.start();
            } catch {
                // ignora reinício duplicado
            }
        }
    };
}

if (!SpeechRecognition) {
    document.getElementById("status").innerText =
        "Reconhecimento de voz não suportado.";
} else {
    document.body.addEventListener("click", () => {
        if (!escutaAtiva) {
            iniciarReconhecimento();
        }
    });

    document.getElementById("status").addEventListener("click", () => {
        if (!escutaAtiva) {
            iniciarReconhecimento();
        }
    });

    speechSynthesis.onvoiceschanged = () => {
        vozesCarregadas = true;
        if (!escutaAtiva) {
            iniciarReconhecimento();
        }
    };
}