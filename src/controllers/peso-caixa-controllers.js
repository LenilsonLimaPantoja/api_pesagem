const { default: axios } = require("axios");
const executeQuery = require("../../pgsql");

exports.readPesoCaixas = async (req, res, next) => {
    try {
        const { apicultor_id } = req.dados;
        const { caixa_id } = req.params;

        const responsePesoCaixa = await executeQuery(
            `SELECT peso_caixa.id as id, 
                    peso_caixa.peso_atual as peso_atual, 
                    peso_caixa.criado_em as criado_em, 
                    peso_caixa.caixa_id as caixa_id,
                    caixas.apicultor_id as apicultor_id 
             FROM peso_caixa 
             LEFT JOIN caixas ON peso_caixa.caixa_id = caixas.id
             WHERE caixas.apicultor_id = $1 and caixas.id = $2
             AND peso_caixa.criado_em >= NOW() - INTERVAL '7 days'
             ORDER BY peso_caixa.id asc`, // Adicionando filtro para os últimos 7 dias
            [apicultor_id, caixa_id]
        );

        if (responsePesoCaixa.length === 0) {
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
            registros: responsePesoCaixa
        });

    } catch (error) {
        console.error("Erro ao buscar peso:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao buscar peso, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};

exports.createPesoCaixa = async (req, res, next) => {
    try {
        let { peso_atual, identificador_balanca } = req.body;

        if (!identificador_balanca) {
            return res.status(400).send({
                retorno: {
                    status: 400,
                    mensagem: "Campos obrigatórios ausentes. Verifique os dados e tente novamente.",
                },
                registros: []
            });
        }

        let responseConsultcaixa = [];

        try {
            responseConsultcaixa = await axios.get(`https://api-pesagem.vercel.app/caixa/identificador-balanca/${identificador_balanca}`);
        } catch (error) {
            res.status(500).send({
                retorno: {
                    status: 500,
                    mensagem: error.response.data.retorno.mensagem,
                },
                registros: []
            });
        }

        const caixa_id = responseConsultcaixa.data.registros[0].id;

        const result = await executeQuery(
            `INSERT INTO peso_caixa (peso_atual, criado_em, caixa_id)
            VALUES ($1, NOW(), $2)
            RETURNING id, peso_atual, criado_em, caixa_id;`,
            [peso_atual, caixa_id]);

        res.status(201).send({
            retorno: {
                status: 201,
                mensagem: "Seu peso foi cadastrado com sucesso.",
            },
            registros: result
        });

    } catch (error) {
        console.error("Erro ao cadastrar peso:", error);
        res.status(500).send({
            retorno: {
                status: 500,
                mensagem: "Erro ao cadastrar peso, tente novamente.",
                erro: error.message
            },
            registros: []
        });
    }
};