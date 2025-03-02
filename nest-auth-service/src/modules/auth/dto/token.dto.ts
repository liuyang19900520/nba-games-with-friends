export class TokenDto {
  access_token: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}
