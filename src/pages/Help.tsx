import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BreadcrumbNav } from "@/components/ui/breadcrumb-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, Mail, MessageCircle, Search, Video } from "lucide-react";

const Help = () => {
  return (
    <div className="container py-8 space-y-6">
      <BreadcrumbNav
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Ajuda" },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold text-foreground">Central de Ajuda</h1>
        <p className="text-muted-foreground mt-1">
          Documentação, tutoriais e suporte para o sistema
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar na documentação..."
          className="pl-10"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover-scale cursor-pointer">
          <CardHeader>
            <BookOpen className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Documentação</CardTitle>
            <CardDescription>
              Guias completos e referências da API
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-scale cursor-pointer">
          <CardHeader>
            <Video className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Tutoriais em Vídeo</CardTitle>
            <CardDescription>
              Aprenda com exemplos práticos em vídeo
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="hover-scale cursor-pointer">
          <CardHeader>
            <MessageCircle className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Suporte</CardTitle>
            <CardDescription>
              Entre em contato com nossa equipe
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perguntas Frequentes (FAQ)</CardTitle>
          <CardDescription>
            Respostas para as dúvidas mais comuns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>Como adicionar um novo parceiro?</AccordionTrigger>
              <AccordionContent>
                Para adicionar um novo parceiro, acesse o Dashboard, selecione a aba "Parceiros" 
                e clique no botão "Novo Parceiro". Preencha as informações necessárias incluindo 
                nome, descrição e URL base da API. Após salvar, você poderá adicionar serviços 
                específicos para este parceiro.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>Como configurar um serviço SOAP?</AccordionTrigger>
              <AccordionContent>
                Ao criar ou editar um serviço de parceiro, selecione "SOAP" como tipo de serviço. 
                Informe a URL do serviço SOAP e configure as credenciais necessárias. O sistema 
                irá validar a conexão e permitir que você teste o endpoint antes de salvar.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Como funcionam os termos de busca?</AccordionTrigger>
              <AccordionContent>
                Os termos de busca são palavras-chave utilizadas nas sincronizações para filtrar 
                resultados relevantes. Você pode criar termos globais ou associá-los a parceiros 
                e serviços específicos. Os termos podem ser do tipo "Processos", "Distribuições" 
                ou "Publicações" e são aplicados automaticamente durante as sincronizações.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>Como agendar sincronizações automáticas?</AccordionTrigger>
              <AccordionContent>
                Acesse as Configurações no menu lateral, vá para a aba "Sincronização" e ative 
                a opção "Sincronização Automática". Você pode escolher o intervalo desejado entre 
                15 minutos e 12 horas. As sincronizações serão executadas automaticamente no 
                intervalo configurado.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>Como gerar relatórios personalizados?</AccordionTrigger>
              <AccordionContent>
                Na página de Relatórios, selecione o tipo de relatório desejado (Sincronizações, 
                Desempenho de Parceiros, etc.) e o período. Você pode escolher períodos pré-definidos 
                ou personalizar as datas. Após gerar, é possível exportar em PDF ou Excel.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>Como testar endpoints da API?</AccordionTrigger>
              <AccordionContent>
                Utilize o Playground de API disponível no menu lateral. Selecione o endpoint que 
                deseja testar, preencha os parâmetros necessários e clique em "Enviar Requisição". 
                O sistema mostrará a resposta e exemplos de código em várias linguagens para 
                facilitar a integração.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Guias Rápidos</CardTitle>
          <CardDescription>
            Tutoriais passo a passo para tarefas comuns
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
            <h3 className="font-medium mb-1">Primeiros Passos</h3>
            <p className="text-sm text-muted-foreground">
              Configure seu primeiro parceiro e realize a primeira sincronização
            </p>
          </div>
          
          <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
            <h3 className="font-medium mb-1">Configurando Webhooks</h3>
            <p className="text-sm text-muted-foreground">
              Aprenda a configurar webhooks para receber notificações em tempo real
            </p>
          </div>
          
          <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
            <h3 className="font-medium mb-1">Gerenciamento de Tokens</h3>
            <p className="text-sm text-muted-foreground">
              Crie e gerencie tokens de API para integração com sistemas externos
            </p>
          </div>
          
          <div className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors">
            <h3 className="font-medium mb-1">Monitoramento e Logs</h3>
            <p className="text-sm text-muted-foreground">
              Monitore o desempenho do sistema e analise logs de sincronização
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Precisa de Mais Ajuda?</CardTitle>
          <CardDescription>
            Nossa equipe está pronta para auxiliar você
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Email</p>
              <p className="text-sm text-muted-foreground">suporte@exemplo.com</p>
            </div>
          </div>
          
          <Button className="w-full">
            <MessageCircle className="h-4 w-4 mr-2" />
            Abrir Ticket de Suporte
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Help;
