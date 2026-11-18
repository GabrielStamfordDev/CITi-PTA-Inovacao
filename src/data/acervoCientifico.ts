export interface ScientificSourceMeta {
  filename: string;
  title: string;
  institution: string;
  year: string;
  focus: string;
  documentType?: string;
}

export interface ScientificChunk {
  id: string;
  topic: string;
  sourceFile: string;
  extraSources?: string[];
  keywords: string[];
  whyItHappens: string;
  whatToDo: string[];
  whatToAvoid: string[];
  whenToSeekDoctor: string;
  followUpSuggestions: string[];
  provenance?: "curated-summary";
}

export const SCIENTIFIC_SOURCES: ScientificSourceMeta[] = [
  {
    filename: "abraz-orientacoes.pdf",
    title: "Orientações para Cuidadores de Pessoas com Doença de Alzheimer",
    institution: "ABRAz — Associação Brasileira de Alzheimer e Condições Similares",
    year: "2026",
    focus: "Higiene, alimentação, segurança, manejo de sintomas, cuidado profissional e direitos no SUS/Receita Federal",
    documentType: "guia_cuidadores",
  },
  {
    filename: "drlucasgeriatra-idoso-quer-sair-de-casa.pdf",
    title: "Idoso com Alzheimer Quer Sair de Casa: Por Que Isso Acontece e Como Agir Sem Piorar a Agitação",
    institution: "Dr. Lucas Motta — Médico Geriatra (CRM/SP 156.222 | RQE 121021)",
    year: "2026",
    focus: "Desejo de ir embora, síndrome do entardecer (sundowning), validação e redirecionamento",
    documentType: "artigo_geriatria",
  },
  {
    filename: "drlucasgeriatra-perambulacao-no-alzheimer.pdf",
    title: "Perambulação no Alzheimer: Por Que o Idoso Anda Sem Parar e Como Protegê-lo",
    institution: "Dr. Lucas Motta — Médico Geriatra (CRM/SP 156.222 | RQE 121021)",
    year: "2026",
    focus: "Perambulação (wandering), adaptação ambiental, identificação, GPS e condução segura",
    documentType: "artigo_geriatria",
  },
  {
    filename: "API_04-Banho.pdf",
    title: "Estratégias para o Banho de Pessoas Diagnosticadas com a Doença de Alzheimer",
    institution: "Profa. Dra. Thais Bento Lima-Silva, Glaucia Alvarenga & Laís Silva (EACH-USP / ABRAz-SP)",
    year: "2021",
    focus: "Resistência ao banho, preservação da dignidade, segurança no banheiro e autonomia",
    documentType: "cartilha_tecnica",
  },
  {
    filename: "API_05-Dialogo.pdf",
    title: "Estratégias de Diálogo e Manejo Comportamental no Idoso com Demência: O Guia Definitivo para Cuidadores",
    institution: "Dr. Fernando Freire — Médico Geriatra (HC-FMUSP | CRM 179451)",
    year: "2026",
    focus: "Terapia de Validação (Naomi Feil), comunicação não-imperativa, repetição de perguntas e desescalada",
    documentType: "guia_comportamental",
  },
  {
    filename: "API_01-MS-PCDT-DA.pdf",
    title: "Protocolo Clínico e Diretrizes Terapêuticas (PCDT) da Doença de Alzheimer — Portaria Conjunta nº 27",
    institution: "Ministério da Saúde / CONITEC (Brasil)",
    year: "2025",
    focus: "Diretrizes nacionais no SUS, tratamento não farmacológico prioritário em SPCD, medicações e apoio psicoterapêutico",
    documentType: "protocolo_clinico",
  },
  {
    filename: "API_02-iSupport-DA.pdf",
    title: "iSupport for Dementia — Training and Support Manual for Carers of People with Dementia",
    institution: "Organização Mundial da Saúde (OMS / WHO)",
    year: "2019",
    focus: "Treinamento global para cuidadores informais, autocuidado emocional, refeições e manejo de comportamentos",
    documentType: "manual_oms",
  },
  {
    filename: "API_03-dementia-assessment-management-and-support.pdf",
    title: "Dementia: Assessment, Management and Support for People Living with Dementia and Their Carers (NG97)",
    institution: "NICE — National Institute for Health and Care Excellence",
    year: "2018/2025",
    focus: "Avaliação estruturada de causas clínicas de agitação (dor, delirium), manejo do sono e suporte aos cuidadores",
    documentType: "diretriz_internacional",
  },
];

export const SCIENTIFIC_CHUNKS: ScientificChunk[] = [
  {
    id: "quer-sair-ir-para-casa",
    topic: "Desejo de sair de casa ou pedir para ir para casa",
    sourceFile: "drlucasgeriatra-idoso-quer-sair-de-casa.pdf",
    extraSources: ["API_05-Dialogo.pdf", "abraz-orientacoes.pdf"],
    keywords: [
      "sair de casa",
      "ir embora",
      "ir para casa",
      "voltar para casa",
      "minha casa",
      "mala",
      "arrumar a mala",
      "fuga",
      "fugir",
      "porta",
      "tranca",
      "nao reconhece a casa",
    ],
    whyItHappens:
      "Esse comportamento não é teimosia: a confusão mental, a desorientação espacial/temporal e memórias antigas (como a casa da infância ou deveres maternos) fazem a pessoa genuinamente acreditar que está em um ambiente estranho. Em muitos casos, pedir para 'ir para casa' significa buscar sensação de segurança e pertencimento, ou tentar aliviar algum desconforto físico não verbalizado (dor, fome, sede ou vontade de ir ao banheiro).",
    whatToDo: [
      "Acolha e valide o sentimento primeiro (Terapia de Validação): diga com voz calma algo como 'Eu entendo que você quer ir para casa, deve ser difícil se sentir assim' ou 'Nós vamos logo mais; antes, me ajuda a dobrar essas toalhas?'.",
      "Redirecione a atenção com gentileza para algo prazeroso e concreto: ofereça um café, um lanche favorito, uma música apreciada ou um álbum de fotos antigas.",
      "Observe se há desconforto físico escondido (dor, frio, sede, fome, bexiga cheia ou fralda suja) e resolva a necessidade.",
      "Reduza ruídos (desligue TV alta), suavize a iluminação no fim da tarde e mantenha uma rotina previsível.",
      "Garanta segurança discreta nas saídas: trancas fora do campo de visão direto, guizo ou sensor na porta e cartão/pulseira de identificação.",
    ],
    whatToAvoid: [
      "Não discuta nem tente provar logicamente ('Você mora aqui há 30 anos!', 'Já está na sua casa'): o Alzheimer compromete o raciocínio lógico e o confronto apenas gera medo, incompreensão e mais agitação.",
      "Não fale com impaciência nem tente impedir fisicamente de forma brusca: mesmo sem reter todas as palavras, a pessoa percebe o tom emocional hostil.",
    ],
    whenToSeekDoctor:
      "Procure o médico geriatra se as tentativas de saída acontecerem várias vezes ao dia, envolverem risco real de fuga ou se a agitação tiver surgido de forma súbita (pode indicar dor ou infecção urinária).",
    followUpSuggestions: [
      "Como lidar com a agitação no fim da tarde (pôr do sol)?",
      "O que fazer quando ele anda sem parar pela casa (perambulação)?",
    ],
  },
  {
    id: "perambulacao-seguranca",
    topic: "Perambulação (andar sem parar) e prevenção de desaparecimento",
    sourceFile: "drlucasgeriatra-perambulacao-no-alzheimer.pdf",
    extraSources: ["abraz-orientacoes.pdf", "API_02-iSupport-DA.pdf"],
    keywords: [
      "perambulacao",
      "wandering",
      "anda sem parar",
      "andando pela casa",
      "caminhar",
      "andar sem rumo",
      "se perder",
      "desaparecer",
      "rua",
      "gps",
      "pulseira",
      "identificacao",
      "seguranca",
    ],
    whyItHappens:
      "Até 60% das pessoas com Doença de Alzheimer apresentam perambulação em alguma fase. Ela decorre de desorientação espacial, excesso de energia acumulada, busca por algo ou alguém do passado, ansiedade ambiental ou até efeito colateral de medicamentos (inquietação motora).",
    whatToDo: [
      "Não confronte nem segure à força: aproxime-se devagar e caminhe ao lado em segurança por alguns minutos até que a pessoa se acalme naturalmente.",
      "Verifique necessidades básicas ('Está com fome?', 'Precisa ir ao banheiro?', 'Está com dor?') e redirecione para atividade simples com mãos ou música.",
      "Use identificação contínua: pulseira ou etiqueta interna na roupa com nome, telefone de emergência e a informação de que tem demência; avalie rastreador GPS (relógio ou pingente) e mantenha foto recente no celular.",
      "Adapte o ambiente: retire tapetes soltos e fios do chão, mantenha boa iluminação noturna e instale sensores sonoros/guizos ou trancas discretas nas portas de saída.",
      "Inclua atividade física leve supervisionada durante o dia (caminhada curta ou alongamento) para gastar energia de forma saudável e anotar em quais horários o padrão se repete.",
    ],
    whatToAvoid: [
      "Nunca aplique contenção física nem use frases proibitivas ríspidas ('Você não pode sair', 'Para de andar'): proibições aumentam a frustração e elevam o risco de agressividade ou quedas.",
      "Não permita saídas desacompanhadas em caso de desorientação espacial nem deixe que o paciente dirija veículos.",
    ],
    whenToSeekDoctor:
      "Converse com o geriatra se a perambulação acontecer com frequência de madrugada, após introdução de algum medicamento ou associada a queda ou fuga recente.",
    followUpSuggestions: [
      "Como adaptar a casa para evitar quedas e acidentes?",
      "Quais estratégias ajudam quando há insônia ou troca do dia pela noite?",
    ],
  },
  {
    id: "sundowning-por-do-sol",
    topic: "Síndrome do Pôr do Sol (Sundowning) e Insônia Noturna",
    sourceFile: "drlucasgeriatra-idoso-quer-sair-de-casa.pdf",
    extraSources: ["abraz-orientacoes.pdf", "API_03-dementia-assessment-management-and-support.pdf"],
    keywords: [
      "por do sol",
      "entardecer",
      "sundowning",
      "fim da tarde",
      "17h",
      "18h",
      "noite",
      "insonia",
      "nao dorme",
      "madrugada",
      "trocando o dia pela noite",
      "escurece",
    ],
    whyItHappens:
      "A Síndrome do Pôr do Sol ocorre por alterações no ritmo circadiano (relógio biológico), cansaço acumulado ao longo do dia e mudança abrupta da luminosidade no final da tarde, ampliando sombras e confusão visual.",
    whatToDo: [
      "Acenda as luzes internas antes mesmo de escurecer completamente e feche cortinas caso reflexos na janela causem estranheza ou ilusões visuais.",
      "Reduza estímulos no final da tarde: diminua o volume da TV, evite visitas agitadas ou tarefas complexas nesse horário.",
      "Planeje uma atividade calma e familiar pouco antes do horário crítico (lanche leve, música suave, dobrar panos ou ver fotos antigas).",
      "Para melhorar o sono (abordagem multicomponente recomendada pela diretriz NICE NG97 e ABRAz): exponha o idoso à luz solar e caminhadas leves durante o dia, evite cochilos diurnos longos, garanta quarto silencioso, confortável e sem frio/calor excessivo.",
    ],
    whatToAvoid: [
      "Evite dar tarefas exigentes ou discutir questões difíceis no fim da tarde.",
      "Não medique o sono por conta própria: a diretriz clínica NICE NG97 inclusive contraindica o uso rotineiro de melatonina para insônia na Doença de Alzheimer; qualquer ajuste deve partir do médico.",
    ],
    whenToSeekDoctor:
      "Avise o geriatra caso a inversão dia/noite e a agitação noturna persistam e estejam impedindo o descanso do paciente e do cuidador, ou se surgir agitação súbita.",
    followUpSuggestions: [
      "O que fazer se o familiar tiver alucinações ou medo de sombras?",
      "Como o cuidador pode descansar e evitar o esgotamento?",
    ],
  },
  {
    id: "banho-higiene",
    topic: "Recusa ao banho, higiene pessoal e cuidados bucais",
    sourceFile: "API_04-Banho.pdf",
    extraSources: ["abraz-orientacoes.pdf", "API_05-Dialogo.pdf"],
    keywords: [
      "banho",
      "tomar banho",
      "higiene",
      "escovar os dentes",
      "protese",
      "dentadura",
      "vestir",
      "roupa",
      "constrangimento",
      "medo de agua",
      "box",
      "trancar",
    ],
    whyItHappens:
      "Tomar banho sozinho é um marco básico de autonomia e intimidade desde a infância. Aceitar ajuda expõe vulnerabilidade, pudor (especialmente se o cuidador for do sexo oposto), medo de escorregar ou desconforto com a temperatura da água e com ordens em sequência.",
    whatToDo: [
      "Prepare todo o ambiente antes de chamar a pessoa: aqueça a água, feche portas/janelas para garantir privacidade e deixe sabonete, xampu, toalha e muda de roupa já separados na ordem exata de uso.",
      "Use convite simples e direto ('Vamos tomar banho agora') dando apenas um passo por vez ('Agora vamos tirar a camiseta') e cubra partes do corpo com toalha para preservar a dignidade.",
      "Mantenha autonomia máxima: deixe a pessoa fazer o que ainda consegue sozinha (lavar o rosto, passar sabonete) e apenas complemente o restante.",
      "Torne o banheiro seguro e agradável: instale barras de apoio, piso/tapete antiderrapante, use cadeira ou banco de banho, retire trincos e chaves da porta (para evitar que fique trancada) e use músicas ou sabonetes que a pessoa aprecie.",
      "Para higiene bucal: retire e higienize próteses após as refeições (evitando infecções por restos de comida) e verifique regularmente se a prótese não está folgada ou machucando a gengiva.",
    ],
    whatToAvoid: [
      "Não pergunte 'Você quer tomar banho?' (facilita recusa imediata) e não force ou brigue caso haja grande resistência: pause e tente novamente cerca de 30 minutos depois.",
      "Não trate o idoso como criança nem apresse os movimentos.",
    ],
    whenToSeekDoctor:
      "Se houver lesões na boca/gengiva ou mudança súbita de comportamento associada à recusa de higiene, consulte dentista ou médico.",
    followUpSuggestions: [
      "Como facilitar na hora de escolher e vestir as roupas?",
      "E se ele sentir vergonha porque o cuidador é do sexo oposto?",
    ],
  },
  {
    id: "comunicacao-repeticao",
    topic: "Diálogo, repetição de perguntas e negação do diagnóstico",
    sourceFile: "API_05-Dialogo.pdf",
    extraSources: ["API_02-iSupport-DA.pdf", "abraz-orientacoes.pdf"],
    keywords: [
      "pergunta repetida",
      "repetindo",
      "repeticao",
      "mesma pergunta",
      "dialogo",
      "comunicacao",
      "falar",
      "nao entende",
      "imperativo",
      "validacao",
      "nega",
      "nao aceita",
      "teimosia",
    ],
    whyItHappens:
      "A demência afeta a área cerebral que grava novas memórias ('o botão de gravar está quebrado'), além de desacelerar o processamento de frases longas. Quando a pessoa pergunta pela quinta vez a mesma coisa, para ela é a primeira vez — e frequentemente expressa ansiedade oculta (ex.: 'que horas você volta?' pode significar medo de ficar só).",
    whatToDo: [
      "Chame a pessoa pelo nome para focar a atenção, posicione-se na mesma altura dos olhos, mantenha contato visual/tátil afetuoso e reduza barulhos ao redor.",
      "Use frases curtas, diretas e um comando por vez; prefira perguntas fechadas ('Você quer frango ou peixe?') ou 2 opções visuais (mostrar duas camisas) em vez de perguntas abertas complexas.",
      "Na repetição de perguntas: responda com calma como se fosse a primeira vez; escreva a resposta em papel grande em local visível e aponte para ele; investigue a emoção ou gatilho real por trás da pergunta (dor, medo, notícia na TV) e redirecione gentilmente.",
      "Quando o paciente negar o diagnóstico, trabalhe apenas com os sintomas específicos sem cobrar rótulos ('Vamos tomar o remédio juntos agora como fazemos todo dia').",
    ],
    whatToAvoid: [
      "Nunca diga 'Eu já te disse isso!', 'Você não lembra?' ou 'Pai, você tem Alzheimer': expor a falha apenas gera vergonha, defensividade e estresse para ambos.",
      "Evite linguagem infantilizada (voz de bebê, diminutivos como 'vozinho quer papá'): estudos mostram que isso eleva a resistência e irritação aos cuidados.",
      "Não dê 5 ou 6 variações da mesma ordem seguidas sobre um objeto; escolha uma frase curta e repita com calma.",
    ],
    whenToSeekDoctor:
      "Se a repetição vier acompanhada de agitação crescente, desconforto ou sofrimento contínuo, converse com o médico sobre ajustes de rotina ou avaliação clínica.",
    followUpSuggestions: [
      "Como lidar quando ele(a) acusa alguém de roubo ou tem alucinações?",
      "Como evitar o tom de ordem no dia a dia?",
    ],
  },
  {
    id: "alimentacao-disfagia",
    topic: "Recusa alimentar, perda de peso, engasgos e fome exagerada",
    sourceFile: "abraz-orientacoes.pdf",
    extraSources: ["API_05-Dialogo.pdf", "API_02-iSupport-DA.pdf"],
    keywords: [
      "comer",
      "alimentacao",
      "comida",
      "apetite",
      "recusa comer",
      "nao quer comer",
      "engasgo",
      "engasgando",
      "degluticao",
      "disfagia",
      "fome exagerada",
      "ja almocou",
      "perda de peso",
    ],
    whyItHappens:
      "A recusa alimentar pode ocorrer por dor ou machucado na boca, dificuldade de deglutição/engasgo, distração por perda de atenção, incapacidade de reconhecer a comida ou sensação de sobrecarga diante de pratos muito cheios. Já a fome repetida acontece porque o paciente esquece que acabou de comer ou perde controle da saciedade.",
    whatToDo: [
      "A regra de ouro prática: ofereça, insista com gentileza, mas nunca force. Se recusar, tente novamente após cerca de 30 minutos com uma opção diferente.",
      "Estimule o apetite: sirva pequenas porções de cada vez, utilize pratos/utensílios coloridos para dar contraste à comida, priorize receitas familiares da história do paciente, coma junto para dar o exemplo e desligue a TV.",
      "Garanta segurança térmica e física: verifique a temperatura da comida para não queimar a boca, examine a boca buscando aftas/lesões e use prato térmico se o paciente comer devagar.",
      "Em caso de fome exagerada ('ainda não almocei'): não discuta ('Você acabou de comer!'); diga 'Veja, seu prato já está limpo, que tal um lanchinho daqui a pouco?', fraccione pequenas porções a cada 2h30 e evite alimentos muito calóricos.",
      "Acompanhe o peso mensalmente: perda igual ou superior a 5% em relação ao mês anterior exige avaliação imediata.",
    ],
    whatToAvoid: [
      "Não confie apenas em perguntas por telefone sobre se o idoso que mora só se alimentou (ele pode responder que sim por não lembrar).",
      "Não deixe o paciente sozinho preparando comida no fogão sem supervisão quando houver perda de planejamento ou memória.",
    ],
    whenToSeekDoctor:
      "Ao notar pigarros constantes, tosse ou engasgos nas refeições, ou recusa persistente de líquidos/alimentos e perda de peso >= 5%, procure imediatamente o médico e um fonoaudiólogo (que pode orientar dieta pastosa ou adaptação segura).",
    followUpSuggestions: [
      "Quais cuidados ajudam quando o familiar esquece que já almoçou?",
      "Como preparar o ambiente durante as refeições?",
    ],
  },
  {
    id: "agressividade-delirios-alucinacoes",
    topic: "Agressividade, delírios (roubo/ciúmes), alucinações e causas médicas",
    sourceFile: "abraz-orientacoes.pdf",
    extraSources: ["API_03-dementia-assessment-management-and-support.pdf", "API_05-Dialogo.pdf", "API_01-MS-PCDT-DA.pdf"],
    keywords: [
      "agressivo",
      "agressividade",
      "raiva",
      "bater",
      "gritar",
      "delirio",
      "roubo",
      "roubaram",
      "ciumes",
      "alucinacao",
      "vendo coisas",
      "ouvindo vozes",
      "infeccao urinaria",
      "dor",
      "sexual",
    ],
    whyItHappens:
      "Cerca de 90% das pessoas com Alzheimer apresentam Sintomas Psicológicos e Comportamentais da Demência (SPCD) em algum momento. Eles não são ataques pessoais: frequentemente surgem de medo, frustração por perda de controle, estímulos ambientais confusos (sombras, barulho) ou de uma causa física oculta — como dor, constipação intestinal ou infecção urinária.",
    whatToDo: [
      "Investigue primeiro causas clínicas e ambientais (diretriz NICE NG97 e PCDT-MS): houve piora súbita? O idoso pode estar com dor, infecção urinária, desidratação, prisão de ventre, fome ou efeito de algum remédio?",
      "Em delírios (ex.: 'roubaram meu dinheiro'): mantenha-se fora do delírio, valide a preocupação sem confirmar a acusação ('Entendo que está preocupado com seu dinheiro. Vamos procurar juntos?') e mude gentilmente o foco para outra atividade. Anote os esconderijos habituais do paciente e cheque o lixo antes de descartar.",
      "Em alucinações: nunca discuta se o que ele vê existe ou não; cheque sombras, plantas ou espelhos mal iluminados que possam gerar ilusões; segure a mão com calma para confortar e redirecione a atenção para algo real e agradável.",
      "Em episódios de agitação/raiva: crie um ambiente silencioso com poucos estímulos, use música ou fotos antigas para acalmar e faça um pequeno diário anotando hora e contexto do episódio para levar ao médico.",
      "Em desinibição sexual: não humilhe nem repreenda agressivamente; mantenha a calma, redirecione para outra atividade em outro cômodo e estabeleça limites serenos.",
    ],
    whatToAvoid: [
      "Não entre em confronto para provar que ninguém roubou ou que a alucinação não é real: isso inclui o cuidador no papel de 'ameaça' dentro do delírio.",
      "Não utilize medicamentos calmantes ou antipsicóticos sem rigorosa prescrição médica: protocolos clínicos (MS-PCDT e NICE NG97) priorizam medidas comportamentais e ambientais primeiro.",
    ],
    whenToSeekDoctor:
      "Procure atendimento médico com urgência se a agressividade ou confusão surgiu de forma repentina (forte suspeita de delirium por infecção ou dor) ou se houver risco físico ao paciente ou à família.",
    followUpSuggestions: [
      "Como montar um diário simples de gatilhos para mostrar ao geriatra?",
      "O que observar para suspeitar de infecção urinária ou dor oculta?",
    ],
  },
  {
    id: "medicacao-direitos-sus",
    topic: "Administração de medicamentos, direitos no SUS e Isenção de IR",
    sourceFile: "API_01-MS-PCDT-DA.pdf",
    extraSources: ["abraz-orientacoes.pdf", "API_03-dementia-assessment-management-and-support.pdf"],
    keywords: [
      "remedio",
      "medicamento",
      "medicacao",
      "sus",
      "gratuito",
      "donepezila",
      "galantamina",
      "rivastigmina",
      "memantina",
      "direitos",
      "imposto de renda",
      "isencao",
      "inss",
      "curatela",
      "laudo",
      "portaria 703",
    ],
    whyItHappens:
      "Muitas famílias arcam com altos custos sem saber que o SUS (Portaria 703/2002 e PCDT-DA/MS 2025) garante medicamentos gratuitos e que a legislação prevê isenção de Imposto de Renda em aposentadorias e pensões sob enquadramento de Alienação Mental.",
    whatToDo: [
      "Medicamentos gratuitos no SUS (PCDT-DA/MS 2025): Donepezila, Galantamina, Rivastigmina (incluindo adesivos transdérmicos) e Memantina são fornecidos gratuitamente conforme critérios clínicos (avaliação médica, exames e escores no MEEM/CDR). Procure a atenção básica/UBS para encaminhamento ao especialista e entrega na farmácia de alto custo.",
      "Documentação básica exigida pelo SUS para medicamentos de alto custo: LME (Laudo de Solicitação em 3 vias), Formulário 13, Termo de Consentimento Informado, Mini-Exame do Estado Mental (MEEM), Receita de controle especial em 2 vias, além de cópias do RG, CPF, comprovante de residência e Cartão SUS.",
      "Na administração diária dos remédios: mantenha uma lista atualizada em local seguro (com horários, doses e alergias), evite deixar frascos ao alcance do paciente e faça revisão periódica com o médico para reduzir fármacos com alta carga anticolinérgica (que pioram a cognição).",
      "Isenção de Imposto de Renda (IN 15/01 da Receita Federal): aposentados ou pensionistas com DA podem solicitar isenção protocolando carta simples e Laudo Médico Pericial oficial constando a designação 'ALIENAÇÃO MENTAL' e o CID (passível inclusive de restituição retroativa de até 5 anos a partir do diagnóstico, mediante perícia oficial do INSS/órgão pagador).",
    ],
    whatToAvoid: [
      "Nunca altere doses, suspenda medicações por conta própria ou triture comprimidos de liberação prolongada/cápsulas sem autorização expressa do médico ou farmacêutico.",
      "Não deixe grandes quantidades de dinheiro, senhas ou documentos sem transição segura (considere débito automático, conta conjunta de confiança ou Curatela judicial quando necessário).",
    ],
    whenToSeekDoctor:
      "Converse com o geriatra ou médico da UBS antes de qualquer ajuste de medicação, caso o paciente recuse engolir comprimidos (o adesivo transdérmico de rivastigmina pode ser avaliado pelo médico) ou se houver efeitos colaterais.",
    followUpSuggestions: [
      "Quais documentos preciso levar para pedir os remédios no SUS?",
      "Como organizar documentos e proteger as finanças do familiar?",
    ],
  },
  {
    id: "saude-mental-cuidador-apoio",
    topic: "Sobrecarga, estresse, saúde mental do cuidador e grupos de apoio",
    sourceFile: "API_02-iSupport-DA.pdf",
    extraSources: ["abraz-orientacoes.pdf", "API_01-MS-PCDT-DA.pdf", "drlucasgeriatra-perambulacao-no-alzheimer.pdf"],
    keywords: [
      "cansado",
      "cansada",
      "exausto",
      "exausta",
      "sobrecarga",
      "sobrecarregado",
      "estresse",
      "culpa",
      "chorando",
      "sozinho",
      "sozinha",
      "saude mental",
      "depressao",
      "ansiedade",
      "grupo de apoio",
      "abraz",
      "ajuda",
      "desabafar",
      "eventos",
    ],
    whyItHappens:
      "O cuidado contínuo modifica toda a rotina familiar, reduz horas de sono e isola socialmente o cuidador principal. Como lembram os especialistas e manuais da OMS (iSupport) e da ABRAz: você não consegue cuidar de quem ama se estiver esgotado — 'no avião, primeiro colocamos a máscara de oxigênio em nós mesmos'. Sentir raiva, tristeza ou exaustão é humano e não diminui seu amor nem seu esforço.",
    whatToDo: [
      "Não carregue tudo sozinho(a): peça ajuda específica a outros familiares (ex.: ficar 2 horas no sábado para você dormir ou sair), avalie apoio profissional ou cuidado compartilhado quando viável e abandone a ideia de que só você sabe fazer certo.",
      "Participe de grupos de apoio (como os encontros gratuitos da ABRAz): estudos clínicos e o PCDT do Ministério da Saúde confirmam que trocar experiências e intervenções psicoeducacionais/terapêuticas reduzem significativamente sintomas de depressão, ansiedade e estresse do cuidador.",
      "Pratique micro-pausas reais (técnicas do manual iSupport da OMS): reserve alguns minutos diários para respiração calma, mantenha alguma atividade prazerosa na sua semana e observe pensamentos de culpa excessiva substituindo-os por metas realistas.",
      "Aqui no próprio CuiDA, consulte as abas 'Links de Apoio' e 'Eventos e Encontros' para acessar grupos da ABRAz-PE, comunidades moderadas e palestras gratuitas.",
    ],
    whatToAvoid: [
      "Não se isole nem ignore sinais de esgotamento físico ou emocional no seu próprio corpo (insônia persistente, crises de choro, irritabilidade constante ou adoecimento).",
    ],
    whenToSeekDoctor:
      "Se você estiver sentindo tristeza profunda, insônia severa, crises de pânico ou exaustão incapacitante, procure também acompanhamento médico e psicológico para você — sua saúde é tão prioritária quanto a do seu familiar.",
    followUpSuggestions: [
      "Quais grupos de apoio e eventos gratuitos existem no CuiDA?",
      "Como envolver outros familiares para dividir as tarefas do cuidado?",
    ],
  },
  {
    id: "fases-doenca-decisoes",
    topic: "Estágios da Doença de Alzheimer (Inicial, Moderada e Avançada) e Tomada de Decisões",
    sourceFile: "abraz-orientacoes.pdf",
    extraSources: ["API_03-dementia-assessment-management-and-support.pdf", "API_01-MS-PCDT-DA.pdf"],
    keywords: [
      "fases",
      "estagio",
      "estagios",
      "inicial",
      "leve",
      "moderada",
      "avancada",
      "grave",
      "evolucao",
      "decisao",
      "decisoes",
      "revelar diagnostico",
      "contar diagnostico",
      "dirigir",
      "institucionalizacao",
    ],
    whyItHappens:
      "A Doença de Alzheimer evolui de forma progressiva em três grandes fases (Inicial/Leve, Moderada e Avançada), alterando gradualmente a autonomia e o grau de supervisão necessária.",
    whatToDo: [
      "Fase Inicial (Leve): alterações na memória recente, troca de nomes, perda de atenção e pouca necessidade de ajuda física. É o melhor momento para conversar abertamente com respeito à vontade do paciente, planejar decisões futuras de forma compartilhada (NICE NG97) e incentivar estímulo cognitivo (como Terapia de Estimulação Cognitiva).",
      "Fase Moderada: surgem sintomas comportamentais (delírios, agitação, perambulação), piora da linguagem, julgamento prejudicado e maior dependência nas atividades diárias. O foco passa a ser supervisão crescente, segurança em casa/trânsito/finanças e divisão de tarefas familiares.",
      "Fase Avançada (Grave): dificuldade para reconhecer pessoas, incontinência de esfíncteres, comprometimento importante da linguagem/motor e necessidade de cuidados intensivos e constantes. Priorize conforto, comunicação não verbal afetuosa, prevenção de engasgos/feridas e apoio multiprofissional ou institucionalização respeitosa se necessário.",
      "Adote ajuda gradual em qualquer fase: 1) observe sem interferir se estiver seguro; 2) auxilie verbalmente passo a passo ('fazer junto'); 3) só faça pelo paciente aquilo que ele realmente já não consegue executar.",
    ],
    whatToAvoid: [
      "Não antecipe perdas retirando abruptamente toda a autonomia na fase inicial, nem deixe decisões críticas (condução de veículos, controle de fogão ou finanças) desprotegidas quando os riscos aparecerem.",
    ],
    whenToSeekDoctor:
      "Mantenha acompanhamento regular com geriatra, neurologista ou psiquiatra para reavaliar o estadiamento clínico e adaptar o plano terapêutico a cada mudança de fase.",
    followUpSuggestions: [
      "Como saber quando o idoso não deve mais dirigir?",
      "Quais terapias não farmacológicas ajudam na fase leve ou moderada?",
    ],
  },
];
