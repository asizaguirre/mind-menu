import axios from 'axios';

const RAILWAY_API = "https://backboard.railway.app/graphql/v2"; // Usando v2, que é mais recente

/**
 * Função auxiliar para fazer requisições autenticadas à API GraphQL do Railway.
 * @param query A query ou mutation GraphQL.
 * @param variables As variáveis para a query.
 */
async function railwayRequest(query: string, variables?: Record<string, any>) {
  try {
    const response = await axios.post(
      RAILWAY_API,
      { query, variables },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.RAILWAY_TOKEN}`
        }
      }
    );

    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }

    return response.data.data;
  } catch (error: any) {
    console.error("Erro na requisição para a API do Railway:", error.response?.data || error.message);
    throw error;
  }
}

export async function createRestaurantService(restaurantName: string) {
  const query = `
    mutation serviceCreate($input: ServiceCreateInput!) {
      serviceCreate(input: $input) {
        id
        name
      }
    }
  `;
  const variables = {
    input: {
      name: `${restaurantName}-service`,
      source: { image: "node:18" }, // Inicia com uma imagem base do Node.js
      projectId: process.env.RAILWAY_PROJECT_ID,
    }
  };
  const data = await railwayRequest(query, variables);
  return data.serviceCreate;
}

export async function listServices(projectId: string) {
  const query = `
    query project($id: String!) {
      project(id: $id) {
        services {
          edges {
            node {
              id
              name
              deployments(first: 1) {
                edges {
                  node {
                    id
                    status
                  }
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await railwayRequest(query, { id: projectId });
  return data.project.services;
}

export async function setVariables(serviceId: string, variables: { key: string, value: string }[]) {
  const query = `
    mutation variableCollectionUpsert($serviceId: String!, $variables: [VariableUpsertInput!]!) {
      variableCollectionUpsert(input: {
        projectId: "${process.env.RAILWAY_PROJECT_ID}",
        serviceId: $serviceId,
        variables: $variables
      })
    }
  `;
  const formattedVariables = variables.map(({ key, value }) => ({ name: key, value }));
  const gqlVariables = {
    serviceId,
    variables: formattedVariables,
  };
  return await railwayRequest(query, gqlVariables);
}

export async function deleteService(serviceId: string) {
  const query = `
    mutation serviceDelete($id: String!) {
      serviceDelete(id: $id) {
        id
        name
      }
    }
  `;
  const data = await railwayRequest(query, { id: serviceId });
  return data.serviceDelete;
}