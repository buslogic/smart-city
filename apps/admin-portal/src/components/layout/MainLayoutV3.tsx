import React from 'react';
import { Outlet } from 'react-router-dom';

// Stub komponenta - koristi se ModernMenuV1 umesto ove
const MainLayoutV3: React.FC = () => {
  return (
    <div>
      <h1>MainLayoutV3 - Deprecated</h1>
      <p>Please use ModernMenuV1 instead</p>
      <Outlet />
    </div>
  );
};

export default MainLayoutV3;