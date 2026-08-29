import { Input as AntInput } from "antd";
import type { InputRef } from "antd";
import * as React from "react";

export const Input = React.forwardRef<InputRef, React.ComponentProps<typeof AntInput>>((props, ref) => <AntInput ref={ref} {...props} />);
Input.displayName = "Input";
