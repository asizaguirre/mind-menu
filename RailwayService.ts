import { GraphQLClient, gql } from 'graphql-request';

interface CreateRestaurantInput {
  restaurantName: string;
  projectId: string;
  githubRepo: string; // Ex: "seu-usuario/mind-menu-restaurant"
  envVars: Record<string, string>;
}

interface ServiceCreateResponse {
  serviceCreate: {
    id: string;
    name: string;
  };
}

export class RailwayService {
  private client: GraphQLClient;
  private readonly RAILWAY_API_URL = 'https://backboard.railway.app/graphql/v2';

  constructor(apiToken: string) {
    this.client = new GraphQLClient(this.RAILWAY_API_URL, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Orquestra a criação completa de um novo restaurante no Railway
   */
  async createRestaurantService(input: CreateRestaurantInput) {
    try {
      console.log(`[Railway] Iniciando deploy para: ${input.restaurantName}`);

      // 1. Criar o Serviço Vazio
      const serviceId = await this.createService(input.projectId, input.restaurantName);
      console.log(`[Railway] Serviço criado com ID: ${serviceId}`);

      // 2. Conectar ao Repositório do GitHub (Template do Restaurante)
      await this.connectGitHubRepo(serviceId, input.githubRepo);
      console.log(`[Railway] Repositório ${input.githubRepo} conectado.`);

      // 3. Injetar Variáveis de Ambiente
      await this.upsertVariables(input.projectId, serviceId, input.envVars);
      console.log(`[Railway] Variáveis de ambiente configuradas.`);

      return { success: true, serviceId };
    } catch (error) {
      console.error('[Railway] Erro ao criar restaurante:', error);
      throw new Error('Falha na orquestração da infraestrutura do restaurante.');
    }
  }

  // --- Métodos Privados (GraphQL Mutations) ---

  private async createService(projectId: string, name: string): Promise<string> {
    const mutation = gql`
      mutation serviceCreate($projectId: String!, $name: String!) {
        serviceCreate(input: { projectId: $projectId, name: $name }) {
          id
          name
        }
      }
    `;

    const data = await this.client.request<ServiceCreateResponse>(mutation, {
      projectId,
      name,
    });
    return data.serviceCreate.id;
  }

  private async connectGitHubRepo(serviceId: string, repo: string): Promise<void> {
    // O Railway precisa ter permissão no GitHub para acessar este repo
    const mutation = gql`
      mutation serviceUpdate($id: String!, $repo: String!) {
        serviceUpdate(id: $id, input: { source: { repo: $repo } }) {
          id
        }
      }
    `;

    await this.client.request(mutation, { id: serviceId, repo });
  }

  private async upsertVariables(
    projectId: string,
    serviceId: string,
    variables: Record<string, string>
  ): Promise<void> {
    const mutation = gql`
      mutation variableCollectionUpsert($projectId: String!, $serviceId: String!, $variables: [VariableUpsertInput!]!) {
        variableCollectionUpsert(input: { projectId: $projectId, serviceId: $serviceId, variables: $variables })
      }
    `;

    const formattedVariables = Object.entries(variables).map(([key, value]) => ({
      name: key,
      value: value,
    }));

    await this.client.request(mutation, {
      projectId,
      serviceId,
      variables: formattedVariables,
    });
  }
}