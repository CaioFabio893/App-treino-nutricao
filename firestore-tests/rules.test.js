// Testes automatizados das Security Rules do Firestore.
//
// Rodam EXCLUSIVAMENTE contra o Firestore Emulator (nunca produção).
// Cobertura (modelo de 2 papéis: admin | student):
//   1. Criar users/{uid} com role/status/plano/features/campo administrativo → NEGADO
//   2. Alterar depois role/status/plan/features/… → NEGADO (fora de fluxo autorizado)
//   3. Acesso ao próprio perfil → respeitar a política
//   4. Acesso a dados de outro usuário → NEGADO quando não autorizado
//   5. Usuário bloqueado (inactive/rejected) acessando recursos protegidos → NEGADO
//   6. pending_approval executando operações de usuário ativo → NEGADO
//   7. Aluno acessando dado de OUTRO aluno → NEGADO; admin e o próprio → PERMITIDO
//   8. Operação administrativa válida → somente pelo mecanismo autorizado (API Go)
//   9. users update — allowlist estrita (hardening Fase 1)
//  10. Biblioteca de exercícios (F5) — catálogo global
//  11. Programas de treinamento (F19) — só API Go
//  12. paused: aprovação e pausa são eixos SEPARADOS (paused não é "não aprovado")
// Regressão: criação direta de users/{uid} com role admin NUNCA é permitida.

'use strict';

const fs = require('fs');
const path = require('path');

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const PROJECT_ID = 'treino-louise';
const FIRESTORE_PORT = 8080;
const RULES = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

let testEnv;

/** Cria um contexto autenticado como um dado uid. */
const authed = (uid) => testEnv.authenticatedContext(uid);
const db = (ctx) => ctx.firestore();

/** Semeia dados usando um contexto com regras desabilitadas (equivale ao Admin SDK). */
async function seed(ops) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fdb = ctx.firestore();
    for (const [col, docsData] of Object.entries(ops)) {
      for (const [id, data] of Object.entries(docsData)) {
        await fdb.collection(col).doc(id).set(data);
      }
    }
  });
}

  /** Semeia um documento em um caminho arbitrário (ex.: users/alice/legacy/s1). */
async function seedAt(pathParts, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const fdb = ctx.firestore();
    let ref = fdb.collection(pathParts[0]);
    for (let i = 1; i + 1 < pathParts.length; i += 2) {
      ref = ref.doc(pathParts[i]).collection(pathParts[i + 1]);
    }
    await ref.doc(pathParts[pathParts.length - 1]).set(data);
  });
}

/** Cria o doc de perfil de um usuário no emulador (via Admin). */
async function seedUser(uid, overrides = {}) {
  await seed({
    users: {
      [uid]: {
        name: 'Fulano',
        email: `${uid}@example.com`,
        role: 'student',
        status: 'active',
        ...overrides,
      },
    },
  });
}

describe('Planos removidos — dados legados continuam protegidos', () => {
  for (const role of ['student', 'admin']) {
    it(`${role} não lê nem escreve plans legados`, async () => {
      await seedUser('legacy-reader', { role });
      await seedAt(['plans', 'old-plan'], { name: 'legado' });
      const ref = db(authed('legacy-reader')).doc('plans/old-plan');
      await assertFails(ref.get());
      await assertFails(ref.set({ name: 'novo' }));
      await assertFails(ref.delete());
    });
  }
});

describe('Comunidade removida — dados legados continuam protegidos', () => {
  for (const role of ['student', 'admin']) {
    it(`${role} não lê nem escreve posts legados`, async () => {
      await seedUser('legacy-reader', { role });
      await seedAt(['posts', 'old-post'], { userId: 'legacy-reader', text: 'legado' });
      const ref = db(authed('legacy-reader')).doc('posts/old-post');
      await assertFails(ref.get());
      await assertFails(ref.set({ text: 'novo' }));
      await assertFails(ref.delete());
    });
  }
  for (const field of ['photoURL', 'bio']) {
    it(`perfil não aceita campo removido ${field}`, async () => {
      await seedUser('alice');
      await assertFails(db(authed('alice')).doc('users/alice').update({ [field]: 'valor' }));
    });
  }
});

describe('Gamificação removida — dados legados continuam protegidos', () => {
  for (const role of ['student', 'admin']) {
    it(`${role} não lê nem escreve scores legados`, async () => {
      await seedUser('legacy-reader', { role });
      await seedAt(['scores', 'legacy-reader'], { score: 10 });
      await seedAt(['scores_history', 'legacy-reader', 'cycles', '2026-Q3'], { score: 10 });
      const fdb = db(authed('legacy-reader'));
      for (const docPath of ['scores/legacy-reader', 'scores_history/legacy-reader/cycles/2026-Q3']) {
        await assertFails(fdb.doc(docPath).get());
        await assertFails(fdb.doc(docPath).set({ score: 1 }));
      }
    });
  }
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: '127.0.0.1',
      port: FIRESTORE_PORT,
      rules: RULES,
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Regras do Firestore', () => {
  describe('1. Regressão: criar perfil com privilégios → NEGADO', () => {
    it('criar users/alice com role=admin → NEGADO (regressão explícita)', async () => {
      const alice = authed('alice').firestore();
      await assertFails(
        alice.doc('users/alice').set({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'admin',
          status: 'active',
        })
      );
    });

    it('criar users/alice com status=active → NEGADO', async () => {
      const alice = authed('alice').firestore();
      await assertFails(
        alice.doc('users/alice').set({
          name: 'Alice',
          email: 'alice@example.com',
          status: 'active',
        })
      );
    });

    it('criar users/alice com planID/features → NEGADO', async () => {
      const alice = authed('alice').firestore();
      await assertFails(
        alice.doc('users/alice').set({
          name: 'Alice',
          email: 'alice@example.com',
          status: 'pending_approval',
          planID: 'plan-completo',
          features: ['workouts', 'diet', 'community'],
        })
      );
    });

    it('criar users/alice com campo administrativo (approvedBy) → NEGADO', async () => {
      // O modelo é de 2 papéis e não tem mais campo de vínculo. O que se
      // preserva aqui é a REGRA: perfil pending criado pelo próprio cliente não
      // pode carregar nenhum campo administrativo, e approvedBy é o caso
      // representativo que não é coberto pelo teste de planID/features acima.
      const alice = authed('alice').firestore();
      await assertFails(
        alice.doc('users/alice').set({
          name: 'Alice',
          email: 'alice@example.com',
          status: 'pending_approval',
          approvedBy: 'admin-xyz',
        })
      );
    });

    it('criar users/alice pendente SEM campos administrativos → PERMITIDO', async () => {
      const alice = authed('alice').firestore();
      await assertSucceeds(
        alice.doc('users/alice').set({
          name: 'Alice',
          email: 'alice@example.com',
          status: 'pending_approval',
        })
      );
    });

    it('criar perfil de OUTRO uid → NEGADO', async () => {
      await seedUser('alice');
      const bob = authed('bob').firestore();
      await assertFails(
        bob.doc('users/alice').set({
          name: 'Mentira',
          email: 'fake@example.com',
          status: 'pending_approval',
        })
      );
    });
  });

  describe('2. Alterações posteriores de campos administrativos → NEGADO', () => {
    it('aluno tenta mudar o próprio status (pending → active) → NEGADO', async () => {
      await seedUser('alice', { status: 'pending_approval' });
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/alice').update({ status: 'active' }));
    });

    it('aluno tenta se promover a admin → NEGADO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/alice').update({ role: 'admin' }));
    });

    it('aluno tenta se atribuir planID → NEGADO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/alice').update({ planID: 'plan-completo' }));
    });

    it('aluno tenta se atribuir features → NEGADO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/alice').update({ features: ['diet'] }));
    });

    it('aluno atualiza dados não-administrativos do próprio perfil → PERMITIDO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertSucceeds(alice.doc('users/alice').update({ name: 'Alice Silva' }));
    });
  });

  describe('3. Acesso ao próprio perfil → respeita a política', () => {
    it('aluno lê o próprio perfil → PERMITIDO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertSucceeds(alice.doc('users/alice').get());
    });

    it('perfil pendente lê o próprio perfil (para saber o status) → PERMITIDO', async () => {
      await seedUser('bob', { status: 'pending_approval' });
      const bob = authed('bob').firestore();
      await assertSucceeds(bob.doc('users/bob').get());
    });
  });

  describe('4. Acesso a dados de outro usuário → NEGADO quando não autorizado', () => {
    it('aluno lê perfil de outro aluno → NEGADO', async () => {
      await seedUser('alice');
      await seedUser('carol');
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/carol').get());
    });

    it('aluno lê subcoleção legada de outro aluno → NEGADO', async () => {
      await seedUser('alice');
      await seedAt(['users', 'carol', 'sessions', 's1'], { ts: 'x' });
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/carol/sessions/s1').get());
    });

    it('dono lê a própria subcoleção legada → NEGADO (modelo removido)', async () => {
      // O modelo antigo (sessions/prs/state) foi removido. Nenhuma regra casa
      // users/{uid}/{subcollection}/{docId}, então o Firestore nega por padrão —
      // inclusive para o próprio dono. Guardião contra regra reintroduzida.
      await seedUser('alice');
      await seedAt(['users', 'alice', 'sessions', 's1'], { ts: 'x' });
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/alice/sessions/s1').get());
    });

    it('escrita em subcoleção legada → NEGADO para o dono', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertFails(
        alice.doc('users/alice/prs/main').set({ a: 1, b: 2, c: 3 })
      );
    });
  });

  describe('5. Usuário bloqueado/inativo acessando recursos protegidos → NEGADO', () => {
    it('inactive lê post do feed → NEGADO', async () => {
      await seedUser('blocked', { status: 'inactive' });
      await seed({ posts: { p1: { userId: 'active-user', text: 'oi' } } });
      const blocked = authed('blocked').firestore();
      await assertFails(blocked.doc('posts/p1').get());
    });

    it('rejected lê post do feed → NEGADO', async () => {
      await seedUser('blocked', { status: 'rejected' });
      await seed({ posts: { p1: { userId: 'active-user', text: 'oi' } } });
      const blocked = authed('blocked').firestore();
      await assertFails(blocked.doc('posts/p1').get());
    });

    it('inactive lê planos → NEGADO', async () => {
      await seedUser('blocked', { status: 'inactive' });
      await seed({ plans: { p1: { name: 'Completo', features: ['diet'] } } });
      const blocked = authed('blocked').firestore();
      await assertFails(blocked.doc('plans/p1').get());
    });

    it('inactive tenta criar post → NEGADO', async () => {
      await seedUser('blocked', { status: 'inactive' });
      const blocked = authed('blocked').firestore();
      await assertFails(
        blocked.doc('posts/novo').set({ userId: 'blocked', text: 'oi' })
      );
    });
  });

  describe('6. pending_approval executando operações de usuário ativo → NEGADO', () => {
    it('pending lê post do feed → NEGADO', async () => {
      await seedUser('pendente', { status: 'pending_approval' });
      await seed({ posts: { p1: { userId: 'active-user', text: 'oi' } } });
      const pendente = authed('pendente').firestore();
      await assertFails(pendente.doc('posts/p1').get());
    });

    it('pending tenta criar post → NEGADO', async () => {
      await seedUser('pendente', { status: 'pending_approval' });
      const pendente = authed('pendente').firestore();
      await assertFails(
        pendente.doc('posts/novo').set({ userId: 'pendente', text: 'oi' })
      );
    });

    it('pending lê planos → NEGADO', async () => {
      await seedUser('pendente', { status: 'pending_approval' });
      await seed({ plans: { p1: { name: 'Completo', features: ['diet'] } } });
      const pendente = authed('pendente').firestore();
      await assertFails(pendente.doc('exercises/supino').get());
    });
  });

  describe('7. Aluno acessando dado de OUTRO aluno → NEGADO (self/admin)', () => {
    // Modelo de 2 papéis: o dono (studentId == auth.uid) e o admin. Não há
    // terceiro papel de gestão, então a matriz de canViewStudentData é
    // exatamente isto — e é a mesma de service.CanAccessResource na API Go.
    beforeEach(async () => {
      await seedUser('admin-sys', { role: 'admin' });
      await seedUser('aluno-a');
      await seedUser('aluno-b');
      await seed({
        dietLogs: {
          logA: { studentId: 'aluno-a', text: 'dia ok' },
          logB: { studentId: 'aluno-b', text: 'dia ok' },
        },
      });
    });

    it('aluno-b lê dietLog do aluno-a → NEGADO', async () => {
      const alunoB = authed('aluno-b').firestore();
      await assertFails(alunoB.doc('dietLogs/logA').get());
    });

    it('aluno-a lê o próprio dietLog legado → NEGADO', async () => {
      const alunoA = authed('aluno-a').firestore();
      await assertFails(alunoA.doc('dietLogs/logA').get());
    });

    it('admin lê dietLog legado de qualquer aluno → NEGADO', async () => {
      const admin = authed('admin-sys').firestore();
      await assertFails(admin.doc('dietLogs/logA').get());
    });

    it('admin NÃO pode escrever em dado de aluno pelo client → NEGADO (só API Go)', async () => {
      // canViewStudentData dá LEITURA ao admin. A escrita é negada a todos pelo
      // SDK de cliente (Admin SDK ignora as regras) — separar os dois eixos.
      const admin = authed('admin-sys').firestore();
      await assertFails(admin.doc('dietLogs/logA').update({ text: 'hackeado' }));
      await assertFails(admin.doc('dietLogs/logA').delete());
    });

    it('aluno NÃO pode escrever no próprio dietLog → NEGADO (só API Go)', async () => {
      const alunoA = authed('aluno-a').firestore();
      await assertFails(alunoA.doc('dietLogs/logA').update({ text: 'hackeado' }));
    });
  });

  describe('8. Operações administrativas → somente pelo mecanismo autorizado', () => {
    beforeEach(async () => {
      await seedUser('admin-sys', { role: 'admin' });
      await seedUser('alice');
      await seedUser('carol');
    });

    it('admin muda role de outro usuário pelo SDK de cliente → NEGADO (só API Go)', async () => {
      const admin = authed('admin-sys').firestore();
      await assertFails(admin.doc('users/alice').update({ role: 'admin' }));
    });

    it('admin cria plano pelo SDK de cliente → NEGADO (só API Go)', async () => {
      const admin = authed('admin-sys').firestore();
      await assertFails(
        admin.doc('plans/novo').set({ name: 'Completo', features: ['diet'], active: true })
      );
    });

    it('admin exclui usuário pelo SDK de cliente → NEGADO (só API Go)', async () => {
      const admin = authed('admin-sys').firestore();
      await assertFails(admin.doc('users/carol').delete());
    });

    it('admin lê perfil de outro usuário → PERMITIDO (leitura administrativa)', async () => {
      const admin = authed('admin-sys').firestore();
      await assertSucceeds(admin.doc('users/alice').get());
    });

    it('cliente não autenticado lê quota de qualquer coisa → NEGADO', async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertFails(anon.doc('posts/p1').get());
    });
  });

  describe('9. users update — allowlist estrita (hardening Fase 1)', () => {
    // A atualização via SDK de cliente só pode tocar nos campos que o fluxo
    // real envia pela API (GET/PUT /api/me): name, email, photoURL, bio.
    // Qualquer outro campo — inclusive createdAt e authProvider (controles
    // internos) — nega o update inteiro (affectedKeys().hasOnly).

    describe('campos protegidos, um a um → NEGADO', () => {
      const sensitiveFields = [
        ['role', { role: 'admin' }],
        ['status', { status: 'active' }, { status: 'pending_approval' }],
        ['planID', { planID: 'plan-completo' }],
        ['features', { features: ['diet'] }],
        ['startDate', { startDate: '2026-09-01' }],
        ['createdAt', { createdAt: '2026-09-20T00:00:00Z' }],
        ['approvedBy', { approvedBy: 'admin-xyz' }],
        ['approvedAt', { approvedAt: '2026-09-20T00:00:00Z' }],
        ['rejectedReason', { rejectedReason: 'docs falsos' }],
        ['authProvider', { authProvider: 'google' }],
      ];

      sensitiveFields.forEach(([field, update, seedOverrides]) => {
        it(`${field} → NEGADO`, async () => {
          // status exige seed com valor diferente (senão o update é no-op e
          // não conta como "chave afetada" no diff).
          await seedUser('alice', seedOverrides);
          const alice = authed('alice').firestore();
          await assertFails(alice.doc('users/alice').update(update));
        });
      });
    });

    describe('campos legítimos → PERMITIDO', () => {
      it('name → PERMITIDO (fluxo real: PUT /api/me)', async () => {
        await seedUser('alice');
        const alice = authed('alice').firestore();
        await assertSucceeds(alice.doc('users/alice').update({ name: 'Alice Silva' }));
      });

      it('email → PERMITIDO (fluxo real: PUT /api/me)', async () => {
        await seedUser('alice');
        const alice = authed('alice').firestore();
        await assertSucceeds(alice.doc('users/alice').update({ email: 'nova@example.com' }));
      });

      it('múltiplos campos legítimos (name + photoURL + bio) → PERMITIDO', async () => {
        await seedUser('alice');
        const alice = authed('alice').firestore();
        await assertSucceeds(
          alice.doc('users/alice').update({
            name: 'Alice Silva',
          })
        );
      });
    });

    describe('combinação legítimo + sensível → NEGADO (hasOnly bloqueia o update inteiro)', () => {
      const attacks = [
        ['name + role', { name: 'Hacker', role: 'admin' }],
        ['name + status', { name: 'Hacker', status: 'active' }, { status: 'pending_approval' }],
        ['name + startDate', { name: 'Hacker', startDate: '2026-10-01' }],
        ['name + planID', { name: 'Hacker', planID: 'plan-completo' }],
      ];

      attacks.forEach(([label, update, seedOverrides]) => {
        it(`${label} → NEGADO`, async () => {
          await seedUser('alice', seedOverrides);
          const alice = authed('alice').firestore();
          await assertFails(alice.doc('users/alice').update(update));
        });
      });
    });

    it('documento administrativo completo de uma vez → NEGADO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertFails(
        alice.doc('users/alice').update({
          role: 'admin',
          status: 'active',
          planID: 'plan-completo',
          features: ['workouts', 'diet'],
          approvedBy: 'admin-xyz',
          approvedAt: '2026-09-20T00:00:00Z',
          rejectedReason: null,
        })
      );
    });
  });

  describe('10. Biblioteca de exercícios (F5) — catálogo global', () => {
    beforeEach(async () => {
      await seedUser('admin-sys', { role: 'admin' });
      await seedUser('aluno-ativo', { role: 'student', status: 'active' });
      await seedUser('aluno-pendente', { role: 'student', status: 'pending_approval' });
      await seedUser('aluno-inativo', { role: 'student', status: 'inactive' });
      await seed({
        exercises: {
          supino: { name: 'Supino reto', muscleGroup: 'Peito' },
        },
      });
    });

    it('usuário aprovado (aluno ativo) lê exercício → PERMITIDO', async () => {
      const aluno = authed('aluno-ativo').firestore();
      await assertSucceeds(aluno.doc('exercises/supino').get());
    });

    it('admin lê exercício → PERMITIDO', async () => {
      const admin = authed('admin-sys').firestore();
      await assertSucceeds(admin.doc('exercises/supino').get());
    });

    it('pendente lê exercício → NEGADO', async () => {
      const p = authed('aluno-pendente').firestore();
      await assertFails(p.doc('exercises/supino').get());
    });

    it('inativo lê exercício → NEGADO', async () => {
      const i = authed('aluno-inativo').firestore();
      await assertFails(i.doc('exercises/supino').get());
    });

    it('aluno cria exercício → NEGADO (só API Go)', async () => {
      const aluno = authed('aluno-ativo').firestore();
      await assertFails(aluno.doc('exercises/novo').set({ name: 'Agachamento' }));
    });

    it('admin cria exercício pelo client → NEGADO (só API Go)', async () => {
      const admin = authed('admin-sys').firestore();
      await assertFails(admin.doc('exercises/novo').set({ name: 'Agachamento' }));
    });

    it('aluno atualiza exercício → NEGADO', async () => {
      const aluno = authed('aluno-ativo').firestore();
      await assertFails(aluno.doc('exercises/supino').update({ name: 'Mudado' }));
    });

    it('admin exclui exercício pelo client → NEGADO (só API Go)', async () => {
      const admin = authed('admin-sys').firestore();
      await assertFails(admin.doc('exercises/supino').delete());
    });

    it('não autenticado lê exercício → NEGADO', async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertFails(anon.doc('exercises/supino').get());
    });
  });

  describe('11. Programas de treinamento (F19) — só API Go', () => {
    // O programa é uma lista ordenada de TREINOS (workouts/{id}); assim como
    // treinos e dietas, ele é gerenciado exclusivamente pela API Go (Admin SDK
    // ignora as regras). Nenhum papel — nem admin — acessa pelo SDK de cliente,
    // nem para LEITURA: a listagem de programas do aluno passa pela API.
    beforeEach(async () => {
      await seedUser('admin-sys', { role: 'admin' });
      await seedUser('aluno-ativo', { role: 'student', status: 'active' });
      await seedUser('aluno-pendente', { role: 'student', status: 'pending_approval' });
      await seed({
        programs: {
          'prog-ciclo-2': {
            studentId: 'aluno-ativo',
            name: 'Louise Lima (Ciclo 2)',
            workouts: [{ workoutId: 'w1', order: 1, label: 'A' }],
          },
        },
      });
    });

    it('aluno ativo lê programa → NEGADO (só API Go)', async () => {
      const a = authed('aluno-ativo').firestore();
      await assertFails(a.doc('programs/prog-ciclo-2').get());
    });

    it('DONO do programa (studentId == auth.uid) lê → NEGADO (só API Go)', async () => {
      // Ser o dono não abre exceção: a listagem de programas do aluno passa
      // pela API Go, então nem o próprio dono lê pelo SDK de cliente.
      const a = authed('aluno-ativo').firestore();
      await assertFails(a.doc('programs/prog-ciclo-2').get());
    });

    it('admin lê programa → NEGADO', async () => {
      const a = authed('admin-sys').firestore();
      await assertFails(a.doc('programs/prog-ciclo-2').get());
    });

    it('pendente lê programa → NEGADO', async () => {
      const p = authed('aluno-pendente').firestore();
      await assertFails(p.doc('programs/prog-ciclo-2').get());
    });

    it('aluno lista programas → NEGADO', async () => {
      const a = authed('aluno-ativo').firestore();
      await assertFails(a.collection('programs').get());
    });

    it('admin lista programas → NEGADO', async () => {
      const a = authed('admin-sys').firestore();
      await assertFails(a.collection('programs').get());
    });

    it('aluno cria programa pelo client → NEGADO (só API Go)', async () => {
      const a = authed('aluno-ativo').firestore();
      await assertFails(a.doc('programs/novo').set({ name: 'Programa X' }));
    });

    it('admin cria programa pelo client → NEGADO', async () => {
      const a = authed('admin-sys').firestore();
      await assertFails(a.doc('programs/novo').set({ name: 'Programa X' }));
    });

    it('DONO do programa atualiza → NEGADO (só API Go)', async () => {
      // Regressão do padrão de ownership: mesmo sendo o studentId do programa,
      // a escrita via client é negada — é a API Go que materializa programmes.
      const a = authed('aluno-ativo').firestore();
      await assertFails(a.doc('programs/prog-ciclo-2').update({ name: 'Renomeado' }));
    });

    it('admin exclui programa → NEGADO', async () => {
      const a = authed('admin-sys').firestore();
      await assertFails(a.doc('programs/prog-ciclo-2').delete());
    });

    it('escrita em subcaminho de programa → NEGADO', async () => {
      const a = authed('admin-sys').firestore();
      await assertFails(a.doc('programs/prog-ciclo-2/workouts/w1').set({ name: 'x' }));
      await assertFails(a.doc('programs/prog-ciclo-2/workouts/w1').get());
    });

    it('não autenticado lê programa → NEGADO', async () => {
      const anon = testEnv.unauthenticatedContext().firestore();
      await assertFails(anon.doc('programs/prog-ciclo-2').get());
    });
  });

  describe('12. paused — aprovação e pausa são eixos SEPARADOS', () => {
    // Regra de modelagem: 'paused' NÃO é um status de não-aprovação.
    // isApprovedUser() cuida de aprovação ("" | active | admin-bypass) e
    // isPausedUser() cuida de pausa. Um aluno pausado NÃO pode ser tratado como
    // "não aprovado só por estar pausado" — mas também não vira admin nem
    // ganha leitura de dado alheio, e a allowlist de escrita continua valendo.
    beforeEach(async () => {
      await seedUser('aluno-ativo', { role: 'student', status: 'active' });
      await seedUser('aluno-pausado', { role: 'student', status: 'paused' });
      await seedUser('aluno-pendente', { role: 'student', status: 'pending_approval' });
      await seedUser('outro-aluno', { role: 'student', status: 'active' });
      await seed({
        posts: { p1: { userId: 'aluno-pausado', text: 'oi' } },
        plans: { p1: { name: 'Completo', features: ['diet'] } },
        exercises: { supino: { name: 'Supino reto', muscleGroup: 'Peito' } },
        dietLogs: { logAlheio: { studentId: 'outro-aluno', text: 'dia ok' } },
      });
    });

    // ---- Caso 1: aluno ativo, pausado = false → PERMITIDO ----
    it('Caso 1 — aluno ativo lê recurso de negócio → PERMITIDO', async () => {
      const a = authed('aluno-ativo').firestore();
      await assertFails(a.doc('posts/p1').get());
      await assertFails(a.doc('plans/p1').get());
      await assertSucceeds(a.doc('exercises/supino').get());
    });

    // ---- Caso 2: aluno APROVADO e pausado = true ----
    // O ponto central: pausado NÃO é classificado como "não aprovado".
    it('Caso 2 — aluno pausado NÃO é tratado como não aprovado → PERMITIDO', async () => {
      const a = authed('aluno-pausado').firestore();
      await assertFails(a.doc('posts/p1').get());
      await assertFails(a.doc('plans/p1').get());
      await assertSucceeds(a.doc('exercises/supino').get());
    });

    it('pausado e pending dão respostas DIFERENTES no mesmo recurso', async () => {
      // Prova que os dois eixos são independentes: se 'paused' estivesse
      // dentro de isApprovedUser como "bloqueado", este par seria idêntico.
      const pausado = authed('aluno-pausado').firestore();
      const pendente = authed('aluno-pendente').firestore();
      await assertSucceeds(pausado.doc('exercises/supino').get());
      await assertFails(pendente.doc('exercises/supino').get());
    });

    it('pausado lê o próprio perfil → PERMITIDO', async () => {
      const a = authed('aluno-pausado').firestore();
      await assertSucceeds(a.doc('users/aluno-pausado').get());
    });

    it('pausado atualiza campo editável do próprio perfil → PERMITIDO', async () => {
      const a = authed('aluno-pausado').firestore();
      await assertSucceeds(a.doc('users/aluno-pausado').update({ name: 'Nome Novo' }));
    });

    it('pausado NÃO escapa da allowlist de escrita → NEGADO', async () => {
      const a = authed('aluno-pausado').firestore();
      await assertFails(a.doc('users/aluno-pausado').update({ status: 'active' }));
      await assertFails(a.doc('users/aluno-pausado').update({ role: 'admin' }));
      await assertFails(a.doc('users/aluno-pausado').update({ planID: 'x' }));
    });

    it('pausado NÃO ganha acesso a dado de outro aluno → NEGADO', async () => {
      // Pausa não é promoção: o eixo self/admin continua valendo.
      const a = authed('aluno-pausado').firestore();
      await assertFails(a.doc('dietLogs/logAlheio').get());
      await assertFails(a.doc('users/outro-aluno').get());
    });

    it('pausado NÃO escreve em recurso de negócio → NEGADO (só API Go)', async () => {
      const a = authed('aluno-pausado').firestore();
      await assertFails(a.doc('posts/novo').set({ userId: 'aluno-pausado', text: 'x' }));
      await assertFails(a.doc('plans/novo').set({ name: 'X' }));
    });

    it('pausado não altera o próprio status (auto-retomada) → NEGADO', async () => {
      // isPausedUser() é um PREDICADO, não um direito: o aluno não se despausa
      // pelo SDK de cliente; a decisão é da API Go.
      const a = authed('aluno-pausado').firestore();
      await assertFails(a.doc('users/aluno-pausado').update({ status: 'active' }));
    });
  });
  describe('F5 — histórico e diário aposentados', () => {
    for (const role of ['student', 'admin']) {
      it(`${role} não lê nem escreve coleções legadas`, async () => {
        await seedUser('legacy-reader', { role });
        await seed({ workoutHistory: { old: { studentId: 'legacy-reader' } }, dietLogs: { old: { studentId: 'legacy-reader' } } });
        const store = authed('legacy-reader').firestore();
        for (const collection of ['workoutHistory', 'dietLogs']) {
          await assertFails(store.doc(`${collection}/old`).get());
          await assertFails(store.collection(collection).get());
          await assertFails(store.doc(`${collection}/new`).set({ studentId: 'legacy-reader' }));
          await assertFails(store.doc(`${collection}/old`).update({ note: 'x' }));
          await assertFails(store.doc(`${collection}/old`).delete());
        }
      });
    }
  });
});
