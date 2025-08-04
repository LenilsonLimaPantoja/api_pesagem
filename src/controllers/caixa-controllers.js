const executeQuery = require("../../pgsql");

exports.readCaixas = async (req, res, next) => {
    try {
        const { apicultor_id } = req.dados;
        const { obs_identificador } = req.query;

        const responseCaixa = await executeQuery(
            `SELECT 
                caixas.id as id, 
                caixas.observacao as observacao, 
                caixas.identificador_balanca as identificador_balanca, 
                caixas.criado_em as criado_em, 
                caixas.apicultor_id as apicultor_id, 
                peso_caixa.peso_atual as peso_atual
            FROM caixas
            LEFT JOIN peso_caixa 
                ON caixas.id = peso_caixa.caixa_id
                AND peso_caixa.id = (
                    SELECT peso_caixa.id
                    FROM peso_caixa
                    WHERE peso_caixa.caixa_id = caixas.id
                    ORDER BY peso_caixa.criado_em DESC
                    LIMIT 1
                )
            WHERE caixas.apicultor_id = $1 and (caixas.observacao ilike $2 or caixas.identificador_balanca ilike $3)
            ORDER BY caixas.id DESC`,
            [apicultor_id, `%${obs_identificador}%`, `%${obs_identificador}%`]
        );


        if (responseCaixa.length === 0) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Nenhuma caixa foi localizada.",
                },
                registros: []
            });
        }

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Dados localizados com sucesso.",
            },
            registros: responseCaixa
        });

    } catch (error) {
        console.error("Erro ao buscar caixas:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao buscar caixas, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.readOneCaixaId = async (req, res, next) => {
    try {
        const { apicultor_id } = req.dados;
        const { caixa_id } = req.params;

        const responseCaixa = await executeQuery(
            `SELECT id, observacao, identificador_balanca, criado_em, apicultor_id FROM caixas where apicultor_id = $1 and id = $2`,
            [apicultor_id, caixa_id]
        );

        if (responseCaixa.length === 0) {
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
            registros: responseCaixa
        });

    } catch (error) {
        console.error("Erro ao buscar caixa:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao buscar caixa, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.readOneCaixaIdentificadorBalanca = async (req, res, next) => {
    try {
        const { identificador_balanca } = req.params;

        const responseCaixa = await executeQuery(
            `SELECT id, observacao, identificador_balanca, criado_em, apicultor_id FROM caixas where identificador_balanca = $1`,
            [identificador_balanca]
        );

        if (responseCaixa.length === 0) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: `Nenhuma caixa com o identificador '${identificador_balanca}' foi localizada.`,
                },
                registros: []
            });
        }

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Dados localizados com sucesso.",
            },
            registros: responseCaixa
        });

    } catch (error) {
        console.error("Erro ao buscar caixa:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao buscar caixa, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.createCaixa = async (req, res, next) => {
    try {
        let { observacao, identificador_balanca } = req.body;
        let { apicultor_id } = req.dados;

        if (!observacao || !identificador_balanca || !apicultor_id) {
            return res.status(400).send({
                retorno: {
                    status: 400,
                    mensagem: "Campos obrigatórios ausentes. Verifique os dados e tente novamente.",
                },
                registros: []
            });
        }

        // Verifica se já existe
        const identificadorExistente = await executeQuery(`
            SELECT id FROM caixas WHERE identificador_balanca = $1 AND apicultor_id = $2
        `, [identificador_balanca, apicultor_id]);

        let result;

        if (identificadorExistente.length > 0) {
            // Atualiza observação
            result = await executeQuery(`
                UPDATE caixas
                SET observacao = $1
                WHERE identificador_balanca = $2 AND apicultor_id = $3
                RETURNING id, observacao, identificador_balanca, apicultor_id, criado_em;
            `, [observacao, identificador_balanca, apicultor_id]);

            return res.status(200).send({
                retorno: {
                    status: 200,
                    mensagem: "Caixa atualizada com sucesso.",
                },
                registros: result
            });
        }

        // Se não existe, cria
        result = await executeQuery(`
            INSERT INTO caixas (observacao, identificador_balanca, apicultor_id, criado_em)
            VALUES ($1, $2, $3, NOW())
            RETURNING id, observacao, identificador_balanca, apicultor_id, criado_em;
        `, [observacao, identificador_balanca, apicultor_id]);

        res.status(201).send({
            retorno: {
                status: 201,
                mensagem: "Sua caixa foi cadastrada com sucesso.",
            },
            registros: result
        });

    } catch (error) {
        console.error("Erro ao cadastrar ou atualizar caixa:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao salvar caixa, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.updateCaixa = async (req, res, next) => {
    try {
        let { observacao, identificador_balanca } = req.body;
        let { caixa_id } = req.params;
        const { apicultor_id } = req.dados;

        const resultCaixaExiste = await executeQuery(
            `select id from caixas where identificador_balanca = $1 and id != $2`,
            [identificador_balanca, caixa_id]
        );

        if (resultCaixaExiste.length > 0) {
            return res.status(500).send({
                retorno: { status: 500, mensagem: `Identificador de balança '${identificador_balanca}' já existe para outra caixa.` },
                registros: []
            });
        }

        const campos = [];
        const valores = [];
        let index = 1;

        if (observacao) {
            campos.push(`observacao=$${index++}`);
            valores.push(observacao);
        }
        if (identificador_balanca) {
            campos.push(`identificador_balanca=$${index++}`);
            valores.push(identificador_balanca);
        }

        if (campos.length === 1) {
            return res.status(400).send({
                retorno: { status: 400, mensagem: "Nenhum dado para atualizar." },
                registros: []
            });
        }

        // Buscar dados atuais da caixa
        const caixaAtual = await executeQuery(
            `SELECT * FROM caixas WHERE id = $1 and apicultor_id = $2`,
            [caixa_id, apicultor_id]);

        if (!caixaAtual.length) {
            return res.status(404).send({
                retorno: { status: 404, mensagem: "Caixa não encontrada." },
                registros: []
            });
        }

        // Verificar se os dados realmente mudaram
        const dadosAtuais = caixaAtual[0];
        const isDifferent = (
            (observacao && observacao !== dadosAtuais.observacao) ||
            (identificador_balanca && identificador_balanca !== dadosAtuais.identificador_balanca)
        );

        if (!isDifferent) {
            return res.status(201).send({
                retorno: { status: 201, mensagem: "Nenhuma alteração foi feita." },
                registros: []
            });
        }

        valores.push(caixa_id);
        const query = `UPDATE caixas SET ${campos.join(", ")} WHERE id=$${valores.length} RETURNING *`;

        const result = await executeQuery(query, valores);

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: "Sua caixa foi atualizada com sucesso.",
            },
            registros: result
        });

    } catch (error) {
        console.error("Erro ao atualizar caixa:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao atualizar caixa, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.deleteCaixa = async (req, res, next) => {
    try {
        const { apicultor_id } = req.dados;
        const { caixa_id } = req.params;

        // Verifica se a caixa existe antes de excluir
        const caixaExistente = await executeQuery(
            `SELECT id, observacao, identificador_balanca, apicultor_id FROM caixas WHERE id = $1 and apicultor_id = $2`,
            [caixa_id, apicultor_id]);

        if (!caixaExistente.length) {
            return res.status(404).send({
                retorno: {
                    status: 404,
                    mensagem: "Caixa não encontrada ou já removida.",
                },
                registros: []
            });
        }

        // Excluir caixa ou marcar como inativo
        const deletedCaixa = await executeQuery(
            `DELETE FROM caixas WHERE id=$1 and apicultor_id = $2 RETURNING *;`,
            [caixa_id, apicultor_id]);

        res.status(200).send({
            retorno: {
                status: 200,
                mensagem: `A caixa '${deletedCaixa[0].id}' foi removida com sucesso.`,
            },
            registros: deletedCaixa
        });

    } catch (error) {
        console.error("Erro ao excluir caixa:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro interno ao remover caixa, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};