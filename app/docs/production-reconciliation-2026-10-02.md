# Conciliação do ambiente dev em 2026-10-02

O Worker `fioreze-portais-dev` e o Pages `fioreze-portais-pages-dev` publicados em 2026-09-23 continham alterações ausentes do GitHub. O bundle da versão ativa do Worker foi comparado por módulo com um build da branch do Marketing Planner. Os arquivos estáticos de código e estilos do Pages foram comparados com os servidos em `portal.hoteisfioreze.com.br` após normalizar finais de linha.

Esta branch incorpora as diferenças funcionais observadas: validação de módulos públicos, limites e cache das APIs públicas, galeria de pacotes românticos, número persistido dos pedidos, estado de impressão, faturamento e os arquivos publicados do ERP, Room Service, portal e páginas administrativas. O acesso ao Marketing Planner e seus novos módulos foi preservado.

As migrations `0056_order_display_numbers.sql` e `0057_muller_special_package_gallery.sql` reconstituem o esquema observado no D1 ativo. Elas foram aplicadas com sucesso a um D1 local novo junto às migrations existentes. No ambiente dev remoto, as migrations `0052` a `0060` já constam como aplicadas.

As migrations de dados `0052`, `0053`, `0054`, `0055` e `0058` foram aplicadas diretamente no ambiente dev, mas seu SQL original não está no repositório nem no registro de migrations do D1. Não foram substituídas por arquivos vazios ou por dados presumidos. Para criar outro ambiente idêntico ao dev, ainda será necessário recuperar essas migrations de um backup ou reconstituir e revisar seus dados a partir do D1 existente.
