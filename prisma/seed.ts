import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedUsers() {
  const hashedPassword = await bcrypt.hash("123456", 8);

  await prisma.user.upsert({
    where: { email: "maria@cuida.com" },
    update: {},
    create: {
      nome: "Maria Silva",
      email: "maria@cuida.com",
      senha: hashedPassword,
    },
  });
}

async function seedEventos() {
  const eventosData = [
    {
      titulo: "Webinário sobre Envelhecimento e Sustentabilidade",
      data: "01/04",
      horario: "18:00h às 20:00h",
      local: "Instagram - @abrazalzheimer",
      precisaInscricao: false,
      descricao:
        "Você está convidado para um webinário imperdível que discutirá temas fundamentais como envelhecimento, sustentabilidade, demências, cuidados, ancestralidade e saberes tradicionais.\n\nA iniciativa é uma ótima oportunidade para ampliar seus conhecimentos e interagir com especialistas renomados na área.",
    },
    {
      titulo: "10° Simpósio sobre a Doença de Alzheimer",
      data: "05/11",
      horario: "8:00h às 12:00h",
      local: "Auditório Waly Salomão (UESB), Recife - PE",
      precisaInscricao: true,
      descricao:
        'No dia 05 de novembro, acontecerá o 10° Simpósio sobre a Doença de Alzheimer, com o tema "Inovações para o cuidado integral à saúde".\n\nO evento objetiva promover reflexão e disseminação do conhecimento sobre a temática, assim como contribuir para o alcance e amparo de novos cuidadores e familiares, buscando melhorias no cuidado às pessoas com Alzheimer e para toda a comunidade.',
    },
  ];

  for (const item of eventosData) {
    const existing = await prisma.evento.findFirst({
      where: { titulo: item.titulo },
    });

    if (existing) {
      await prisma.evento.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await prisma.evento.create({ data: item });
    }
  }
}

async function seedLinksApoio() {
  // Links default alinhados às 5 opções do protótipo no Figma.
  // Substitua pelas URLs finais (ex.: convite real do grupo de WhatsApp) quando disponíveis.
  await prisma.linkApoio.deleteMany();
  await prisma.linkApoio.createMany({
    data: [
      {
        categoria: "instagram",
        titulo: "ABRAZ Pernambuco",
        subtitulo: "@abrazpernambuco",
        url: "https://www.instagram.com/abrazpernambuco/",
        icone: "instagram",
      },
      {
        categoria: "whatsapp",
        titulo: "Cuidadores de Recife",
        subtitulo: "Grupo no WhatsApp (link provisório)",
        url: "https://wa.me/5581999999999?text=Ol%C3%A1!%20Gostaria%20de%20participar%20do%20grupo%20de%20cuidadores%20CuiDA.",
        icone: "whatsapp",
      },
      {
        categoria: "facebook",
        titulo: "Cuidadores Pernambuco",
        subtitulo: "Comunidades de cuidadores em Pernambuco",
        url: "https://www.facebook.com/search/groups/?q=cuidadores%20pernambuco",
        icone: "facebook",
      },
      {
        categoria: "facebook",
        titulo: "Grupo de cuidadores de Alzheimer",
        subtitulo: "Busca de grupos de apoio no Facebook",
        url: "https://www.facebook.com/search/groups/?q=cuidadores%20alzheimer%20apoio",
        icone: "facebook",
      },
      {
        categoria: "facebook",
        titulo: "GAFA - Apoio a familiares de pessoas com Alzheimer",
        subtitulo: "Grupo de Apoio a Familiares no Facebook",
        url: "https://www.facebook.com/GAFABURITIS",
        icone: "facebook",
      },
    ],
  });
}

async function seedArtigos() {
  const artigosData = [
    {
      slug: "o-que-e",
      titulo: "O que é?",
      resumo: "O que é Alzheimer?",
      icone: "/assets/artigo-o-que-e.png",
      conteudo: [
        "A doença de Alzheimer (DA) afeta a memória e a capacidade de pensar, piorando com o tempo. É a principal causa de demência e prejudica a independência da pessoa.",
        "Sintomas:",
        "• Esquecimento frequente de fatos recentes\n• Dificuldade para se comunicar ou encontrar palavras\n• Mudanças de humor e comportamento\n• Desorientação no tempo e no espaço",
        "Tratamentos",
        "• Medicamentos para retardar os sintomas\n• Terapias cognitivas e ocupacionais\n• Apoio de cuidadores e rotina estruturada",
      ].join("\n\n"),
    },
    {
      slug: "saude-mental-cuidador",
      titulo: "Saúde mental do cuidador",
      resumo: "Saúde mental do cuidador",
      icone: "/assets/artigo-saude-mental.png",
      conteudo: [
        "Cuidar de alguém com Alzheimer pode ser emocionalmente desgastante, por isso é fundamental que o cuidador cuide da sua própria saúde mental.",
        "1. Tire pausas regulares:",
        "Reserve momentos para descansar e recarregar as energias. Mesmo pequenas pausas ao longo do dia ajudam a reduzir a sobrecarga física e emocional.",
        "2. Busque uma rede de apoio:",
        "Conversar com outros cuidadores, familiares ou grupos como a ABRAz ajuda a compartilhar experiências e aliviar o sentimento de isolamento.",
        "3. Cuide da sua saúde física e emocional:",
        "Procure manter acompanhamento médico, sono regular e, sempre que possível, apoio psicológico para lidar com o estresse contínuo.",
      ].join("\n\n"),
    },
    {
      slug: "orientacoes-alimentacao",
      titulo: "Orientações sobre alimentação",
      resumo: "Orientações sobre alimentação",
      icone: "/assets/artigo-alimentacao.png",
      conteudo: [
        "Para pessoas com Alzheimer, a alimentação pode ser um desafio devido a dificuldades de memória e habilidades motoras. Aqui vão algumas orientações:",
        "Oferecer alimentos nutritivos, como frutas, vegetais, grãos integrais, proteínas magras e gorduras saudáveis, promove o bem-estar geral.",
        "1. Manter uma dieta balanceada e hidratação:",
        "Sirva refeições em horários regulares, em porções menores, incentivando a ingestão de água ao longo do dia mesmo quando o paciente não pedir.",
        "2. Criar um ambiente tranquilo:",
        "Reduza distrações como televisão alta durante as refeições e use pratos com cores contrastantes para facilitar a visualização dos alimentos.",
        "3. Adaptar texturas e incentivar a autonomia:",
        "Quando necessário, corte os alimentos em pedaços pequenos ou adapte a consistência, respeitando o ritmo da pessoa sem apressá-la.",
      ].join("\n\n"),
    },
    {
      slug: "sindrome-por-do-sol",
      titulo: "Síndrome do pôr do sol",
      resumo: "Síndrome do pôr do sol",
      icone: "/assets/artigo-por-do-sol.png",
      conteudo: [
        "A Síndrome do Pôr do Sol (ou sundowning) é um estado de maior confusão, agitação, ansiedade ou inquietação que costuma surgir no final da tarde e início da noite em pessoas com Alzheimer.",
        "O que pode desencadear os sintomas:",
        "• Cansaço acumulado ao longo do dia\n• Diminuição da luz natural e sombras no ambiente\n• Alterações no relógio biológico (ciclo sono-vigília)\n• Excesso de ruídos ou mudanças bruscas de rotina",
        "Como lidar com a Síndrome do Pôr do Sol:",
        "1. Reforce a iluminação no fim da tarde:",
        "Antes de escurecer, acenda as luzes da casa e feche cortinas para evitar sombras que possam causar medo ou confusão.",
        "2. Mantenha uma rotina previsível:",
        "Evite atividades agitadas, cafeína e sonecas longas no período da tarde. Prefira músicas calmas e atividades relaxantes ao entardecer.",
        "3. Acolha sem confrontar:",
        "Fale com voz calma, valide os sentimentos da pessoa e redirecione a atenção para algo familiar e reconfortante.",
      ].join("\n\n"),
    },
    {
      slug: "alzheimer-e-danca",
      titulo: "Alzheimer e dança",
      resumo: "Alzheimer e dança",
      icone: "/assets/artigo-danca.png",
      conteudo: [
        "A dança combinada à música é uma das atividades mais benéficas para pessoas com Doença de Alzheimer, pois ativa memórias afetivas preservadas mesmo em fases mais avançadas.",
        "Benefícios da dança e da música:",
        "• Estimula o equilíbrio, a coordenação motora e a mobilidade\n• Desperta memórias emocionais ligadas a músicas da juventude\n• Reduz a ansiedade, a apatia e sintomas depressivos\n• Fortalece o vínculo afetivo entre o paciente e o cuidador",
        "1. Escolha músicas significativas:",
        "Monte uma seleção com canções que faziam parte da história de vida da pessoa para estimular o bem-estar e a participação espontânea.",
        "2. Respeite os limites físicos:",
        "Os movimentos podem ser feitos em pé com apoio ou até mesmo sentados, acompanhando o ritmo com as mãos e os braços em ambiente seguro e livre de tapetes soltos.",
      ].join("\n\n"),
    },
    {
      slug: "exercicios-fisicos",
      titulo: "Exercícios físicos para pacientes",
      resumo: "Exercícios físicos para pacientes",
      icone: "/assets/artigo-exercicios.png",
      conteudo: [
        "A prática regular de atividades físicas adaptadas ajuda a preservar a autonomia funcional, melhora a qualidade do sono e contribui para o equilíbrio emocional da pessoa com Alzheimer.",
        "1. Caminhadas leves e acompanhadas:",
        "Caminhar em locais planos, bem iluminados e seguros estimula a circulação, reduz a agitação e ajuda a regular o ciclo do sono.",
        "2. Alongamentos e mobilidade:",
        "Movimentos suaves de braços, ombros e pernas ajudam a evitar rigidez muscular e dores articulares.",
        "3. Segurança e orientação profissional:",
        "Sempre priorize atividades adequadas à condição clínica atual e, sempre que possível, conte com orientação de fisioterapeuta ou educador físico.",
      ].join("\n\n"),
    },
  ];

  for (const artigo of artigosData) {
    await prisma.artigo.upsert({
      where: { slug: artigo.slug },
      update: artigo,
      create: artigo,
    });
  }
}

async function seedFaqs() {
  await prisma.faq.deleteMany();
  await prisma.faq.createMany({
    data: [
      {
        ordem: 1,
        pergunta: "O Alzheimer tem cura?",
        resposta:
          "Não, o Alzheimer não tem cura, mas existem tratamentos que podem ajudar a retardar os sintomas.",
      },
      {
        ordem: 2,
        pergunta: "Quais os primeiros sinais do Alzheimer?",
        resposta:
          "Os primeiros sinais costumam incluir esquecimento frequente de fatos recentes, dificuldade para encontrar palavras, repetição de perguntas, desorientação no tempo ou espaço e mudanças sutis de humor ou na realização de tarefas habituais.",
      },
      {
        ordem: 3,
        pergunta: "É normal que os sintomas piorem à noite?",
        resposta:
          "Sim! Esse fenômeno é conhecido como Síndrome do Pôr do Sol. No final da tarde e início da noite, a pessoa pode ficar mais confusa, agitada ou ansiosa. Manter uma rotina calma, boa iluminação e ambiente tranquilo ajuda a reduzir esses episódios.",
      },
      {
        ordem: 4,
        pergunta: "Pessoas mais velhas têm mais chances de terem DA?",
        resposta:
          "Sim. A idade avançada é o principal fator de risco para a Doença de Alzheimer, sendo mais comum após os 65 anos. Contudo, ela não faz parte do envelhecimento normal e também pode ocorrer em pessoas mais jovens.",
      },
    ],
  });
}

async function main() {
  await seedUsers();
  await seedEventos();
  await seedLinksApoio();
  await seedArtigos();
  await seedFaqs();
  console.log("Seed do CuiDA executado com sucesso!");
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed do CuiDA:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
