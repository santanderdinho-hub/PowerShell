# Ofertas Hub

App mobile (Android/iOS/Web) para centralizar ofertas de Amazon, Mercado Livre, Shopee, Magalu, AliExpress e Americanas, redirecionando o usuário via link de afiliado.

Stack: **Expo (React Native) + TypeScript + Expo Router**.

## Telas

- **Ofertas** — feed com filtro por loja, pull-to-refresh, badge de desconto, cupom
- **Favoritos** — ofertas salvas localmente
- **Admin** — cadastro dos seus IDs/tags de afiliado e publicação manual de ofertas

## Como o link de afiliado funciona

Em `lib/affiliate.ts`, ao tocar numa oferta o app injeta seu identificador na URL antes de abrir no navegador externo:

| Loja          | Como é injetado                              |
| ------------- | -------------------------------------------- |
| Amazon        | `?tag=SEU_TAG`                               |
| Mercado Livre | `?matt_tool=ID&matt_word=ID`                 |
| Magalu        | `?partner_id=ID&utm_source=ID`               |
| Americanas    | `?opn=ID`                                    |
| Shopee        | use o link já gerado no portal de afiliados  |
| AliExpress    | use o link já gerado no portal de afiliados  |

Para Shopee e AliExpress, gere o link encurtado no portal oficial e cole direto no campo URL ao cadastrar a oferta.

## Rodando local

```bash
cd apps/deals-aggregator
npm install
npx expo start
```

Escaneie o QR code com o app **Expo Go** (Android/iOS) ou pressione `a`/`i`/`w` para Android/iOS/Web.

## Build de produção

```bash
npx eas build --platform android   # APK/AAB
npx eas build --platform ios       # IPA (requer conta Apple)
```

## Próximos passos

- Migrar ofertas locais (AsyncStorage) para Firebase/Supabase
- Push notifications reais via Expo Push Tokens (hoje só notifica localmente quando você publica no Admin ou puxa pra atualizar)
- Integrar APIs oficiais de afiliado (Amazon PA-API, ML Afiliados) para popular o feed automaticamente
- Proteger a aba Admin com senha/biometria
- Categorias (filtro além de loja)
- Histórico de preço por produto
