/**
 * Seed script — cria tenant demo + usuários + dados de exemplo
 * para permitir rodar o MVP localmente sem precisar passar pelo onboarding.
 *
 * Rode: npm run db:seed
 */

import { PrismaClient } from "@prisma/client";
import { deriveConfig } from "../lib/tenant-config";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Tribo.ai demo data...");

  // Limpa dados antigos do demo
  await prisma.kudos.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.chatSession.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  // Config derivada da "anamnese" demo
  const answers = {
    employeeCount: 42,
    sector: "tech" as const,
    workMode: ["hybrid" as const],
    hrStructure: "partial" as const,
    pains: ["communication" as const, "recognition" as const],
    punchClockSystem: "tangerino" as const,
    values: ["Colaboração", "Inovação", "Respeito", "Excelência"],
    surveyFrequency: "monthly" as const,
    rewardInterest: "symbolic" as const,
    goal: "Melhorar comunicação entre times e aumentar engajamento nos próximos 3 meses",
  };
  const config = deriveConfig(answers);

  // Tenant demo
  const tenant = await prisma.tenant.create({
    data: {
      slug: "demo",
      displayName: "Acme Brasil",
      config: config as any,
      status: "ACTIVE",
      planTier: "GROWTH",
      primaryColor: "#6366f1",
      secondaryColor: "#f59e0b",
    },
  });
  console.log(`✓ Tenant: ${tenant.displayName} (${tenant.id})`);

  // Usuários demo
  const owner = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "demo@tribo.ai",
      name: "Você (Demo)",
      role: "CEO",
      department: "Liderança",
      bio: "Fundador da Acme Brasil. Apaixonado por cultura e tecnologia.",
      skills: ["Liderança", "Estratégia", "Produto"],
      isAdmin: true,
      isOwner: true,
      startedAt: new Date("2020-01-15"),
    },
  });

  const marina = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "marina@acme.com.br",
      name: "Marina Costa",
      role: "Head of People",
      department: "RH",
      bio: "Construindo cultura forte com dados e empatia.",
      skills: ["RH", "Cultura", "People Analytics"],
      isAdmin: true,
      startedAt: new Date("2022-03-10"),
    },
  });

  const joao = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "joao@acme.com.br",
      name: "João Silva",
      role: "Dev Backend Senior",
      department: "Engenharia",
      bio: "10 anos de backend. Café > tudo.",
      skills: ["Node.js", "Postgres", "AWS"],
      startedAt: new Date("2021-07-20"),
    },
  });

  const paula = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: "paula@acme.com.br",
      name: "Paula Mendes",
      role: "Product Designer",
      department: "Produto",
      bio: "UX + research + acessibilidade.",
      skills: ["Figma", "User Research", "Design Systems"],
      startedAt: new Date("2023-02-01"),
    },
  });

  console.log(`✓ 4 usuários criados`);

  // Posts demo
  const post1 = await prisma.post.create({
    data: {
      tenantId: tenant.id,
      authorId: marina.id,
      content:
        "Pessoal, semana que vem temos nossa pesquisa de clima mensal — peço que reservem 3 minutinhos para responder! 🙏 Sua opinião importa muito.",
      visibility: "COMPANY",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    },
  });

  const post2 = await prisma.post.create({
    data: {
      tenantId: tenant.id,
      authorId: joao.id,
      content:
        "Hoje finalizamos a migração do sistema legado. Agradeço à @Paula e ao time de infra pelo suporte nas últimas duas semanas. Colaboração é tudo! 🚀",
      visibility: "COMPANY",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
    },
  });

  // Likes
  await prisma.like.createMany({
    data: [
      { postId: post1.id, userId: joao.id },
      { postId: post1.id, userId: paula.id },
      { postId: post1.id, userId: owner.id },
      { postId: post2.id, userId: marina.id },
      { postId: post2.id, userId: paula.id },
      { postId: post2.id, userId: owner.id },
    ],
  });

  // Comments
  await prisma.comment.create({
    data: {
      postId: post2.id,
      authorId: paula.id,
      content: "Obrigada pela menção, João! Foi um trabalho em equipe incrível 💜",
    },
  });

  console.log(`✓ 2 posts + likes + comentários criados`);

  // Kudos
  await prisma.kudos.createMany({
    data: [
      {
        tenantId: tenant.id,
        senderId: marina.id,
        receiverId: joao.id,
        value: "Colaboração",
        message: "Pelo suporte impecável na migração do sistema!",
      },
      {
        tenantId: tenant.id,
        senderId: joao.id,
        receiverId: paula.id,
        value: "Excelência",
        message: "Suas telas são sempre caprichadas. Aprendo muito com você.",
      },
      {
        tenantId: tenant.id,
        senderId: paula.id,
        receiverId: marina.id,
        value: "Respeito",
        message: "Obrigada por sempre ouvir nossas ideias nas 1:1s!",
      },
    ],
  });
  console.log(`✓ 3 kudos criados`);

  // Ausências (exemplos)
  const today = new Date();
  today.setHours(3, 0, 0, 0); // 00:00 BRT

  await prisma.attendance.create({
    data: {
      tenantId: tenant.id,
      userId: paula.id,
      date: today,
      type: "REMOTE",
      source: "manual",
    },
  });

  console.log(`✓ Ausência de hoje criada`);

  console.log("\n🎉 Seed completo!");
  console.log("\nLogin demo:");
  console.log("  Email: demo@tribo.ai");
  console.log("  (auth mock — logado automaticamente em dev)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
