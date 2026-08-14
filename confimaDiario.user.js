// ==UserScript==
// @name         Confirmador de diario GED
// @namespace    http://tampermonkey.net/
// @version      1.7
// @description  Confirma as presenças dos alunos no sistema GED-Sigeduca com atalhos cumulativos e AutoStart
// @author       Lucas de Souza Monteiro
// @match        http://sigeduca.seduc.mt.gov.br/ged/hwmfinalizaperiodofrequencia.aspx?HWGedLancarAvaliacao.aspx*
// @require      https://code.jquery.com/jquery-3.6.0.min.js
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

// Estilo dos botões
var styleSCT = document.createElement('style');
styleSCT.type = 'text/css';
styleSCT.innerHTML = 'span.button-like{display:inline-block;padding:12px 24px;margin:10px;background-color:#065195;color:#fff;font-weight:bold;border:1px solid #065195;border-radius:4px;cursor:pointer;text-align:center;text-decoration:none}span.button-like:hover{background-color:#0056b3;border-color:#0056b3}';
document.getElementsByTagName('head')[0].appendChild(styleSCT);

// -----------------------------------------------------
// FUNÇÕES AUXILIARES
// -----------------------------------------------------

function selectElement(id, valueToSelect) {
    let element = document.getElementById(id);
    if(element) element.value = valueToSelect;
}

// Retorna Array de Objetos com {value, text}
function getSelectedOptions(selectElement) {
    var selectedOptions = [];
    var options = selectElement.options;
    for (var i = 1; i < options.length; i++) { // Pula a opção 0 (SELECIONE)
        selectedOptions.push({
            value: options[i].value,
            text: options[i].text.trim()
        });
    }
    return selectedOptions;
}

function arrayToHtmlTable(dataArray) {
    var novaJanela = window.open('', '_blank');
    var tabelaHTML = '<head><title>Erros de confirmação de presença</title><style>table{border-collapse: collapse; width: 100%;} th, td{border: 1px solid black; padding: 8px;}</style></head><body><table><thead><tr>';

    if (dataArray.length > 1) {
        dataArray[0].forEach(coluna => { tabelaHTML += '<th>' + coluna + '</th>'; });
        tabelaHTML += '</tr></thead><tbody>';

        for (var i = 1; i < dataArray.length; i++) {
            tabelaHTML += '<tr>';
            dataArray[i].forEach(valor => { tabelaHTML += '<td>' + valor + '</td>'; });
            tabelaHTML += '</tr>';
        }
        tabelaHTML += '</tbody></table></body>';
        novaJanela.document.write(tabelaHTML);
    } else {
        novaJanela.document.write('<p>Nenhum erro encontrado pelo script!</p>');
    }
}

function isNotificationHidden() {
    var notification = document.getElementById('gx_ajax_notification');
    if (notification) {
        var displayStyle = window.getComputedStyle(notification).getPropertyValue('display');
        return displayStyle === 'none';
    }
    return false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

(function() {
    'use strict';

    // -----------------------------------------------------
    // ROTINA PRINCIPAL DO ROBO
    // -----------------------------------------------------
    // Aceita um Array de objetos com value e text. Ex: [{value:"1", text:"1º BIMESTRE"}, ...]
    async function processarBimestres(bimestersArray, autoStarted = false) {
        if(bimestersArray.length === 0) return;

        var output = [['Nome - cod','turma','disciplina','lançou nota?','bimestre']];
        const eek = document.getElementById("vAREADISCIPLINATELA");

        for (let b = 0; b < bimestersArray.length; b++) {
            let bb = bimestersArray[b].value;
            let bText = bimestersArray[b].text;

            console.log("Processando: " + bText);
            let element = document.getElementById('vGEDMATDISCAVAREF');
            element.value = bb;

            var options = eek.options;
            var selectedValues = [];
            for (var k = 0; k < options.length; k++) {
                selectedValues.push(options[k].value);
            }

            var iterations = selectedValues.length;
            for (var i = 0; i < iterations; i++) {
                console.log("Iteração disciplina", i);
                selectElement('vAREADISCIPLINATELA', selectedValues[i]);
                if(eek.onchange) eek.onchange();

                await sleep(500);
                while (!isNotificationHidden()) await sleep(1000);

                // Clica em confirmar
                let btnConfirmar = document.getElementsByClassName("btnConfirmar")[0];
                if(btnConfirmar) btnConfirmar.click();

                await sleep(500);
                while (!isNotificationHidden()) await sleep(1000);

                // Coleta de dados (erros)
                let frameGrids = parent.frames[0]?.document.getElementById('GriddetalhesContainerTbl');
                if (frameGrids) {
                    let tamanhoTabela = frameGrids.rows.length;
                    for (var n = 1; n < tamanhoTabela; n++){
                        let num = ("0000" + n).slice(-4);

                        let spanAlunom = document.getElementById('span_vGEDALUNOM_'+num);
                        let spanRealiza = document.getElementById('span_vREALIZA_'+num);

                        if(!spanAlunom || !spanRealiza) continue;

                        var corTexto = spanAlunom.style.color;
                        var realizar = spanRealiza.textContent.trim();
                        realizar = (corTexto == "rgb(0, 0, 0)") ? "Sim" : "Não";

                        var noconf = parseInt(document.getElementById('span_vQTDFALTASN_'+num).textContent.trim()) +
                                     parseInt(document.getElementById('span_vQTDPRESENCASN_'+num).textContent.trim());
                        var confs = parseInt(document.getElementById('span_vQTDFALTAS_'+num).textContent.trim()) +
                                    parseInt(document.getElementById('span_vQTDPRESENCAS_'+num).textContent.trim());

                        if (realizar == "Sim" && noconf == 0){
                            output.push([
                                spanAlunom.textContent.trim(),
                                document.getElementById('span_vGEDALUCOD_'+num).textContent.trim(),
                                document.getElementById("span_vGERTURSAL").textContent.trim(),
                                eek.options[eek.selectedIndex].text,
                                "Sem presença lançada no "+ bText
                            ]);
                        }
                        if (realizar == "Sim" && confs == 0 && noconf > 0){
                            output.push([
                                spanAlunom.textContent.trim(),
                                document.getElementById('span_vGEDALUCOD_'+num).textContent.trim(),
                                document.getElementById("span_vGERTURSAL").textContent.trim(),
                                eek.options[eek.selectedIndex].text,
                                "Nota/conceito não lançado no "+ bText
                            ]);
                        }
                    }
                }
            }
        }

        arrayToHtmlTable(output);

        // INCREMENTO PARA O SEGUNDO SCRIPT E REDIRECIONAMENTO (QUEBRANDO O IFRAME)
        // Só avança a chave e redireciona caso a rotina tenha sido iniciada via Automático
        if (autoStarted && localStorage.getItem('autoConfirmAtivo') === "1") {
            let currIndex = parseInt(localStorage.getItem('chaveArray') || '0', 10);
            let nextIndex = currIndex + 1;
            localStorage.setItem('chaveArray', nextIndex.toString());
            console.log("Automação finalizada. Incrementando chaveArray para: " + nextIndex);

            // window.top aponta para a janela principal do navegador, forçando ela a navegar
            // e matando qualquer iframe cascata
            window.top.location.href = "http://sigeduca.seduc.mt.gov.br/ged/hwgedlancaravaliacao01.aspx?13,0,HWGedLancarAvaliacao.aspx%3f13%2c0";
        }
    }

    // Criação dos botões baseados no select
    function addCopyBtn(ele, objBimestre) {
        let btn = document.createElement("span");
        btn.innerHTML = "Confirmar " + objBimestre.text;
        btn.className = "button-like";
        btn.onclick = () => {
            processarBimestres([objBimestre]);
        }
        ele.insertBefore(btn, ele.firstChild);
    }

    const selectBimElement = document.getElementById("vGEDMATDISCAVAREF");
    var bimesters = [];
    if(selectBimElement) {
        bimesters = getSelectedOptions(selectBimElement);
        var containerBtns = document.getElementById("TABELASELECAO");
        // Adiciona de trás pra frente pelo insertBefore, mas a ordem não afeta.
        if (containerBtns) {
            for (var i = bimesters.length - 1; i >= 0; i--) {
                addCopyBtn(containerBtns, bimesters[i]);
            }
        }
    }

    // -----------------------------------------------------
    // UI SECRETA (SHIFT + 0)
    // -----------------------------------------------------
    function toggleConfigUI() {
        let existingUi = document.getElementById("autoConfirmUI");
        if (existingUi) {
            existingUi.remove();
            return;
        }

        const ui = document.createElement("div");
        ui.id = "autoConfirmUI";
        ui.style.position = "fixed";
        ui.style.top = "50%";
        ui.style.right = "10px";
        ui.style.transform = "translateY(-50%)";
        ui.style.background = "rgba(30,30,30,0.95)";
        ui.style.color = "white";
        ui.style.padding = "15px";
        ui.style.borderRadius = "10px";
        ui.style.fontFamily = "sans-serif";
        ui.style.zIndex = "99999";
        ui.style.textAlign = "center";
        ui.style.width = "220px";
        ui.style.boxShadow = "0 0 8px rgba(0,0,0,0.5)";

        const titulo = document.createElement("h3");
        titulo.textContent = "Auto Confirm";
        titulo.style.marginTop = "0";

        // Switch Ativo
        const labelAtivo = document.createElement("label");
        labelAtivo.style.display = "block";
        labelAtivo.style.marginBottom = "15px";
        labelAtivo.style.cursor = "pointer";
        const inputCheckbox = document.createElement("input");
        inputCheckbox.type = "checkbox";
        inputCheckbox.checked = localStorage.getItem('autoConfirmAtivo') === "1";
        inputCheckbox.onchange = () => {
            localStorage.setItem('autoConfirmAtivo', inputCheckbox.checked ? "1" : "0");
        };
        labelAtivo.appendChild(inputCheckbox);
        labelAtivo.appendChild(document.createTextNode(" Habilitar Auto Start"));

        // Seleção de limite
        const labelBim = document.createElement("label");
        labelBim.style.display = "block";
        labelBim.style.marginBottom = "15px";
        labelBim.textContent = "Confirmar sozinho até: ";
        const selectBim = document.createElement("select");
        selectBim.style.width = "100%";
        selectBim.style.marginTop = "5px";
        [1, 2, 3, 4].forEach(num => {
            let opt = document.createElement("option");
            opt.value = num;
            opt.text = num + "º Bimestre";
            if(localStorage.getItem('autoConfirmMaxBim') == num.toString()) opt.selected = true;
            selectBim.appendChild(opt);
        });
        selectBim.onchange = () => {
            localStorage.setItem('autoConfirmMaxBim', selectBim.value);
        };
        labelBim.appendChild(selectBim);

        // Indicador (Do outro script)
        const indicador = document.createElement("div");
        let indexArray = parseInt(localStorage.getItem("chaveArray") || "0", 10);
        indicador.textContent = `chaveArray atual: ${indexArray}`;
        indicador.style.marginBottom = "15px";
        indicador.style.fontSize = "14px";
        indicador.style.color = "#ccc";

        const btnClose = document.createElement("button");
        btnClose.textContent = "Salvar e Fechar";
        btnClose.style.width = "100%";
        btnClose.style.padding = "5px";
        btnClose.onclick = () => ui.remove();

        ui.appendChild(titulo);
        ui.appendChild(labelAtivo);
        ui.appendChild(labelBim);
        ui.appendChild(indicador);
        ui.appendChild(btnClose);
        document.body.appendChild(ui);
    }

    // -----------------------------------------------------
    // ATALHOS DE TECLADO
    // -----------------------------------------------------
    function doc_keyUp(e) {
        if (!e.shiftKey) return;

        // SHIFT + 0 (Painel Configuração)
        if (e.code === 'Digit0') {
            toggleConfigUI();
            return;
        }

        // SHIFT + 1, 2, 3, 4 (Atalhos manuais de cumulativo)
        let n = parseInt(e.code.replace('Digit', ''));
        if (n >= 1 && n <= 4) {
            console.log('Atalho disparado: Shift + ' + n);
            let bimestersToRun = [];
            for (let i = 0; i < n && i < bimesters.length; i++) {
                bimestersToRun.push(bimesters[i]);
            }
            if (bimestersToRun.length > 0) {
                processarBimestres(bimestersToRun, false); // False porque é disparo manual
            }
        }
    }
    document.addEventListener('keyup', doc_keyUp, false);

    // -----------------------------------------------------
    // EXECUÇÃO DO AUTO START
    // -----------------------------------------------------
    if (localStorage.getItem('autoConfirmAtivo') === "1") {
        console.log("Auto Confirm Iniciado.");
        let maxBim = parseInt(localStorage.getItem('autoConfirmMaxBim') || '1');
        let bimestersToRun = [];

        for (let i = 0; i < maxBim && i < bimesters.length; i++) {
            bimestersToRun.push(bimesters[i]);
        }

        if (bimestersToRun.length > 0) {
            // Aguarda um pouco para carregar toda a estrutura da página
            setTimeout(() => {
                processarBimestres(bimestersToRun, true); // True sinalizando disparo auto (irá incrementar o índice e redirecionar)
            }, 2500);
        }
    }

})();
