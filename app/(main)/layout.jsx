"use client";

import { Authenticated } from "convex/react";
import React from "react";

const layout = ({ children }) => {
  return (
    <Authenticated>
      <div className="container mx-auto mt-24 mb-20 px-4">{children}</div>
    </Authenticated>
  );
};

export default layout;
