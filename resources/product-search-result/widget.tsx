import { AppsSDKUIProvider } from "@openai/apps-sdk-ui/components/AppsSDKUIProvider";
import { McpUseProvider, useWidget, type WidgetMetadata } from "mcp-use/react";
import React from "react";
import { Link } from "react-router";
import "../styles.css";
import type { ProductSearchResultProps } from "./types";
import { propSchema } from "./types";

export const widgetMetadata: WidgetMetadata = {
  description: "Simple promo kit preview widget kept from the mcp-apps scaffold.",
  props: propSchema,
  exposeAsTool: false,
  metadata: {
    prefersBorder: false,
    invoking: "Loading promo kit...",
    invoked: "Promo kit loaded",
  },
};

const ProductSearchResult: React.FC = () => {
  const { props, isPending } = useWidget<ProductSearchResultProps>();

  return (
    <McpUseProvider>
      <AppsSDKUIProvider linkComponent={Link}>
        <div className="bg-surface-elevated border border-default rounded-2xl p-6">
          <p className="text-sm text-secondary mb-2">Davide Youtube Promo Kit</p>
          <h2 className="heading-lg mb-3">
            {isPending ? "Generating kit..." : props.title}
          </h2>
          <p className="text-md text-secondary">
            {isPending
              ? "The server is calling Exa, fal.ai, and ElevenLabs."
              : props.summary}
          </p>
        </div>
      </AppsSDKUIProvider>
    </McpUseProvider>
  );
};

export default ProductSearchResult;
