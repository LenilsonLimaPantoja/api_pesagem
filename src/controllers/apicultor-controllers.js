const executeQuery = require("../../pgsql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.readOneApicultor = async (req, res, next) => {
    try {
        const { apicultor_id } = req.dados;

        const responseApicultor = await executeQuery(
            `SELECT id, nome, email, criado_em FROM apicultores where id = $1`,
            [apicultor_id]
        );

        if (responseApicultor.length === 0) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Nenhuma informação foi localizada.",
                },
                registros: []
            });
        }

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Dados localizados com sucesso.",
            },
            registros: responseApicultor
        });

    } catch (error) {
        console.error("Erro ao buscar apicultor:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao buscar apicultor, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.createApicultor = async (req, res, next) => {
    try {
        let { nome, email, senha } = req.body;

        if (!nome || !email || !senha) {
            return res.status(400).send({
                retorno: {
                    status: 400,
                    mensagem: "Campos obrigatórios ausentes. Verifique os dados e tente novamente.",
                },
                registros: []
            });
        }

        //verifica se o e-mail já existe
        const emailExistente = await executeQuery(`
            SELECT id, nome, email FROM apicultores WHERE LOWER(email) = $1
        `, [email.toLowerCase()]);

        if (emailExistente.length > 0) {
            return res.status(409).send({
                retorno: {
                    status: 409,
                    mensagem: "E-mail já cadastrado, tente outro.",
                },
                registros: []
            });
        }

        // Hash da senha de forma assíncrona
        const senhaHash = await bcrypt.hash(senha, 10);

        const result = await executeQuery(
            `INSERT INTO apicultores (nome, email, senha, criado_em)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, nome, email, criado_em;`,
            [nome, email, senhaHash]);

        res.status(201).send({
            retorno: {
                status: 201,
                mensagem: "Seu apicultor foi cadastrado com sucesso.",
            },
            registros: result
        });

    } catch (error) {
        console.error("Erro ao cadastrar apicultor:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao cadastrar apicultor, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};


exports.loginApicultor = async (req, res, next) => {
    try {
        let { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).send({
                retorno: {
                    status: 400,
                    mensagem: "Todos os campos devem ser preenchidos, tente novamente.",
                },
                registros: []
            });
        }

        // Converter e-mail para lowercase
        const emailLower = email.toLowerCase();

        const apicultor = await executeQuery(
            `SELECT id, nome, email, senha, criado_em 
            FROM apicultores 
            WHERE LOWER(email) = $1`,
            [emailLower]);

        if (!apicultor || apicultor.length === 0) {
            return res.status(401).send({
                retorno: {
                    status: 401,
                    mensagem: "Falha na autenticação, os dados informados são inválidos.",
                },
                registros: []
            });
        }

        const { id, nome, senha: senhaHash, criado_em } = apicultor[0];


        // Comparar senha fornecida com a armazenada
        const senhaCorreta = await bcrypt.compare(senha, senhaHash);
        if (!senhaCorreta) {
            return res.status(401).send({
                retorno: {
                    status: 401,
                    mensagem: "Falha na autenticação, os dados informados são inválidos.",
                },
                registros: []
            });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { apicultor_id: id, nome, email: emailLower, criado_em },
            process.env.JWT_KEY,
            { expiresIn: "48h" }
        );

        // Criar objeto de resposta sem senha
        const apicultorRetorno = { id, nome, email: emailLower, criado_em, token };

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Apicultor autenticado com sucesso.",
            },
            registros: apicultorRetorno
        });

    } catch (error) {
        console.error("Erro ao autenticar apicultor:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao autenticar apicultor, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.updateApicultor = async (req, res, next) => {
    try {
        let { nome, email } = req.body;
        const { apicultor_id } = req.dados;

        // Converter e-mail para lowercase
        if (email) email = email.toLowerCase();

        const campos = [];
        const valores = [];
        let index = 1;

        if (nome) {
            campos.push(`nome=$${index++}`);
            valores.push(nome);
        }
        if (email) {
            campos.push(`email=$${index++}`);
            valores.push(email);
        }

        if (campos.length === 1) {
            return res.status(400).send({
                retorno: { status: 400, mensagem: "Nenhum dado para atualizar." },
                registros: []
            });
        }

        // Buscar dados atuais do apicultor
        const apicultorAtual = await executeQuery(
            `SELECT * FROM apicultores WHERE id = $1`,
            [apicultor_id]);

        if (!apicultorAtual.length) {
            return res.status(404).send({
                retorno: { status: 404, mensagem: "Apicultor não encontrado." },
                registros: []
            });
        }

        // Verificar se os dados realmente mudaram
        const dadosAtuais = apicultorAtual[0];
        const isDifferent = (
            (nome && nome !== dadosAtuais.nome) ||
            (email && email !== dadosAtuais.email)
        );

        if (!isDifferent) {
            return res.status(400).send({
                retorno: { status: 400, mensagem: "Nenhuma alteração foi feita." },
                registros: []
            });
        }

        valores.push(apicultor_id);
        const query = `UPDATE apicultores SET ${campos.join(", ")} WHERE id=$${valores.length} RETURNING *`;

        const result = await executeQuery(query, valores);

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Seu apicultor foi atualizado com sucesso.",
            },
            registros: result
        });

    } catch (error) {
        console.error("Erro ao atualizar apicultor:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao atualizar apicultor, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.deleteApicultor = async (req, res, next) => {
    try {
        const { apicultor_id } = req.dados;

        // Verifica se o apicultor existe antes de excluir
        const apicultorExistente = await executeQuery(
            `SELECT id, nome, email FROM apicultores WHERE id = $1`,
            [apicultor_id]);

        if (!apicultorExistente.length) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Apicultor não encontrado ou já removido.",
                },
                registros: []
            });
        }

        // Excluir apicultor ou marcar como inativo
        const deletedApicultor = await executeQuery(
            `DELETE FROM apicultores WHERE id=$1 RETURNING *;`,
            [apicultor_id]);

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: `O apicultor '${deletedApicultor[0].nome}' foi removido com sucesso.`,
            },
            registros: deletedApicultor
        });

    } catch (error) {
        console.error("Erro ao excluir apicultor:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro interno ao remover apicultor, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};