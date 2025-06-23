"use client";

import { Authenticated } from "convex/react";
import React from "react";

const layout = ({ children }) => {
  return <Authenticated>{children}</Authenticated>;
};

export default layout;
