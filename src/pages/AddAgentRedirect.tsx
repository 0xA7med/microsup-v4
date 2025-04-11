import React, { useEffect } from 'react';
import { AddAgent } from './AddAgent';

const AddAgentRedirect: React.FC = () => {
  useEffect(() => {
    console.log('AddAgentRedirect component mounted');
  }, []);

  return <AddAgent />;
};

export default AddAgentRedirect;
