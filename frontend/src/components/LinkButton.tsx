import { Button, type ButtonProps } from 'antd';
import { useNavigate } from 'react-router-dom';

interface LinkButtonProps extends Omit<ButtonProps, 'href' | 'onClick'> {
  to: string;
}

// Button that renders as a real link (role link, href, middle-click works)
// but navigates with the router, so the page stays an SPA.
export const LinkButton = ({ to, children, ...rest }: LinkButtonProps) => {
  const navigate = useNavigate();

  return (
    <Button
      {...rest}
      href={to}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </Button>
  );
};
