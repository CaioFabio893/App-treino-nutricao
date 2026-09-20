// Testes automatizados das Security Rules do Firestore.
//
// Rodam EXCLUSIVAMENTE contra o Firestore Emulator (nunca produção).
// Cobertura (rascunho fase Red):
//   1. Criar users/{uid} com role/status/plano/features/nutritionistID → NEGADO
//   2. Alterar depois role/status/plan/features/nutritionistID → NEGADO (fora de fluxo autorizado)
//   3. Acesso ao próprio perfil → respeitar a política
//   4. Acesso a dados de outro usuário → NEGADO quando não autorizado
//   5. Usuário bloqueado (inactive/rejected) acessando recursos protegidos → NEGADO
//   6. pending_approval executando operações de usuário ativo → NEGADO
//   7. Nutricionista acessando recurso de aluno de outro nutricionista → NEGADO
//   8. Operação administrativa válida → somente pelo mecanismo autorizado (API Go)
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

/** Semeia um documento em um caminho arbitrário (ex.: users/alice/sessions/s1). */
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

    it('criar users/alice com nutritionistID → NEGADO', async () => {
      const alice = authed('alice').firestore();
      await assertFails(
        alice.doc('users/alice').set({
          name: 'Alice',
          email: 'alice@example.com',
          status: 'pending_approval',
          nutritionistID: 'nutri-1',
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

    it('aluno tenta mudar o próprio role → NEGADO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/alice').update({ role: 'nutritionist' }));
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

    it('aluno tenta se vincular a um nutricionista → NEGADO', async () => {
      await seedUser('alice');
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/alice').update({ nutritionistID: 'nutri-1' }));
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

    it('aluno lê subcoleção (sessions) de outro aluno → NEGADO', async () => {
      await seedUser('alice');
      await seedAt(['users', 'carol', 'sessions', 's1'], { ts: 'x' });
      const alice = authed('alice').firestore();
      await assertFails(alice.doc('users/carol/sessions/s1').get());
    });

    it('dono lê a própria subcoleção (modo original) → PERMITIDO', async () => {
      await seedUser('alice');
      await seedAt(['users', 'alice', 'sessions', 's1'], { ts: 'x' });
      const alice = authed('alice').firestore();
      await assertSucceeds(alice.doc('users/alice/sessions/s1').get());
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

    it('inactive lê scores (ranking) → NEGADO', async () => {
      await seedUser('blocked', { status: 'inactive' });
      await seed({ scores: { alice: { score: 10 } } });
      const blocked = authed('blocked').firestore();
      await assertFails(blocked.doc('scores/alice').get());
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
      await assertFails(pendente.doc('plans/p1').get());
    });
  });

  describe('7. Nutricionista acessando aluno de outro nutricionista → NEGADO', () => {
    beforeEach(async () => {
      await seedUser('admin-sys', { role: 'admin' });
      await seedUser('nutri-a', { role: 'nutritionist' });
      await seedUser('nutri-b', { role: 'nutritionist' });
      await seedUser('aluno-a', { nutritionistID: 'nutri-a' });
      await seedUser('aluno-b', { nutritionistID: 'nutri-b' });
      await seed({
        dietLogs: {
          logA: { studentId: 'aluno-a', text: 'dia ok' },
          logB: { studentId: 'aluno-b', text: 'dia ok' },
        },
      });
      await seedAt(['scores_history', 'aluno-a', 'cycles', 'c1'], { score: 5 });
      await seedAt(['scores_history', 'aluno-b', 'cycles', 'c1'], { score: 5 });
    });

    it('nutri-b lê dietLog do aluno de nutri-a → NEGADO', async () => {
      const nutriB = authed('nutri-b').firestore();
      await assertFails(nutriB.doc('dietLogs/logA').get());
    });

    it('nutri-a lê dietLog do próprio aluno → PERMITIDO', async () => {
      const nutriA = authed('nutri-a').firestore();
      await assertSucceeds(nutriA.doc('dietLogs/logA').get());
    });

    it('nutri-b lê scores_history do aluno de nutri-a → NEGADO', async () => {
      const nutriB = authed('nutri-b').firestore();
      await assertFails(nutriB.doc('scores_history/aluno-a/cycles/c1').get());
    });

    it('nutri-a lê scores_history do próprio aluno → PERMITIDO', async () => {
      const nutriA = authed('nutri-a').firestore();
      await assertSucceeds(nutriA.doc('scores_history/aluno-a/cycles/c1').get());
    });

    it('admin lê dietLog de qualquer aluno → PERMITIDO', async () => {
      const admin = authed('admin-sys').firestore();
      await assertSucceeds(admin.doc('dietLogs/logA').get());
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
      await assertFails(admin.doc('users/alice').update({ role: 'nutritionist' }));
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
      await assertFails(anon.doc('scores/alice').get());
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
        ['role', { role: 'nutritionist' }],
        ['status', { status: 'active' }, { status: 'pending_approval' }],
        ['planID', { planID: 'plan-completo' }],
        ['features', { features: ['diet'] }],
        ['nutritionistID', { nutritionistID: 'nutri-1' }],
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

      it('email → PERMITIDO (fluxo real: perfil do nutricionista)', async () => {
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
            photoURL: 'https://example.com/foto.jpg',
            bio: 'Atleta amadora',
          })
        );
      });
    });

    describe('combinação legítimo + sensível → NEGADO (hasOnly bloqueia o update inteiro)', () => {
      const attacks = [
        ['name + role', { name: 'Hacker', role: 'admin' }],
        ['name + status', { name: 'Hacker', status: 'active' }, { status: 'pending_approval' }],
        ['name + nutritionistID', { name: 'Hacker', nutritionistID: 'nutri-1' }],
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
          role: 'nutritionist',
          status: 'active',
          planID: 'plan-completo',
          features: ['workouts', 'diet'],
          nutritionistID: 'nutri-1',
          approvedBy: 'admin-xyz',
          approvedAt: '2026-09-20T00:00:00Z',
          rejectedReason: null,
        })
      );
    });
  });
});