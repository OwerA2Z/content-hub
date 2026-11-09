import type { ReactNode } from "react";
import { Alert, Card, Flex, Form, Input, Space, Typography } from "antd";

export function AuthShell({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <Flex justify="center" align="center" style={{ minHeight: "100vh", padding: 24 }}><Card style={{ width: "min(100%, 390px)" }}><Space direction="vertical" size={16} style={{ width: "100%" }}><Space align="center" size={12}><Typography.Title level={3} style={{ margin: 0 }}>文</Typography.Title><Typography.Text strong>内容中台</Typography.Text></Space><Typography.Text type="secondary">{eyebrow}</Typography.Text><Typography.Title level={1} style={{ margin: 0 }}>{title}</Typography.Title>{children}</Space></Card></Flex>;
}

export function AuthInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <Form.Item label={label} required={required} style={{ marginBottom: 16 }}>
      {type === "password" ? (
        <Input.Password
          size="large"
          placeholder={placeholder || `请输入${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          size="large"
          placeholder={placeholder || `请输入${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Form.Item>
  );
}

export function ErrorText({ text }: { text: string }) {
  return text ? <Alert type="error" showIcon message={text} role="alert" style={{ marginBottom: 16 }} /> : null;
}
